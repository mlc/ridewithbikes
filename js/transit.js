/*
 * code behind Ride with Bikes.
 */

String.prototype.slugify = function() {
  return this.toLowerCase().replace(/[^A-Z0-9]+/gi, '-');
};

window.Transit = (function($, _, window, undefined) {
  var that = {};

  var History = window.History;

  var INBOUND = 'inbound', OUTBOUND = 'outbound';

  // some functions which return functions, hooray.
  // reject, accept, maybe are similar enough that we could probably DRY them
  var reject = function(condition, fdir) {
    return (function(date, direction) {
      if ((!fdir || direction == fdir) && condition(date))
        return false;
      else
        return undefined;
    });
  },
  accept = function(condition, fdir) {
    return (function(date, direction) {
      if ((!fdir || direction == fdir) && condition(date))
        return true;
      else
        return undefined;
    });
  },
  maybe = function(condition, fdir) {
    return (function(date, direction) {
      if ((!fdir || direction == fdir) && condition(date))
        return 'maybe';
      else
        return undefined;
    });
  },
  conditions = function() {
    var funs = Array.prototype.slice.call(arguments), len = funs.length;
    return function(date, direction) {
      for (var i = 0; i < len; ++i)  {
        var result = funs[i](date, direction);
        if (result !== undefined)
          return result;
      };

      return undefined;
    };
  };

  // define holidays.
  var Holidays = that.Holidays = (function() {
    var month_day = function(month, day) {
      return function(date) {
        return (date.getMonth() === month && date.getDate() === day);
      };
    },
    month_week_dow = function(month, week, dow, offset) {
      var first_possible, last_possible;
      offset = offset || 0;
      if (week === -1) {
        // only holiday we use this for is in May. FIXME if we have
        // non-31-day months. also if we ever need to say something like
        // "two days after the last Thursday in May" then we are f'ed.
        first_possible = 25 + offset;
        last_possible  = 31 + offset;
      } else {
        // the first Tuesday in March is always between March 1 & March 7.
        first_possible = 1 + (week-1)*7 + offset;
        last_possible  = week*7 + offset;
      }
      return function(date) {
        var day = date.getDate(), test_month = date.getMonth(), test_dow = date.getDay(),
        usual_result = (test_month === month && test_dow === dow && day >= first_possible && day <= last_possible);
        if (first_possible < 0) {
          // only works for 31-day months, which is all we need so far.
          return usual_result || (test_dow === dow && test_month === (month-1) && day >= (first_possible + 31));
        } else {
          return usual_result;
        }
      };
    },
    lunar = function() {
      var days = _(arguments).map(function(d) { return Date.parse(d).toObject(); });
      return function(date) {
        var y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
        return _.any(days, function(hol) {
          return (hol.year === y && hol.month === m && hol.day === d);
        });
      };
    };

    return {
      NEW_YEAR:         month_day(Date.JANUARY, 1),
      PRESIDENTS:       month_week_dow(Date.FEBRUARY, 3, Date.MONDAY),
      ST_PATRICK:       month_day(Date.MARCH, 17),
      GOOD_FRIDAY:      lunar("4/10/2009", "4/2/2010", "4/22/2011", "4/6/2012", "3/29/2013", "4/18/2014"),
      EASTER:           lunar("4/12/2009", "4/4/2010", "4/24/2011", "4/8/2012", "3/31/2013", "4/20/2014"),
      MOTHER:           month_week_dow(Date.MAY, 2, Date.SUNDAY),
      MEMORIAL_FRI:     month_week_dow(Date.MAY, -1, Date.FRIDAY, -3),
      MEMORIAL:         month_week_dow(Date.MAY, -1, Date.MONDAY),
      // MNR says "the day or weekend before Independence Day". WTF?
      // BUG: LIRR says "the weekday before Independence Day".
      JULY_3:           month_day(Date.JULY, 3),
      JULY_4:           month_day(Date.JULY, 4),
      LABOR_FRI:        month_week_dow(Date.SEPTEMBER, 1, Date.FRIDAY, -3),
      LABOR:            month_week_dow(Date.SEPTEMBER, 1, Date.MONDAY),
      EREV_ROSH:        lunar("9/18/2009", "9/8/2010", "9/28/2011", "9/16/2012", "9/4/2013", "9/24/2014"),
      EREV_YOM:         lunar("9/27/2009", "9/17/2010", "10/7/2011", "9/25/2012", "9/13/2013", "10/3/2014"),
      // indigenous peoples' day, a.k.a. columbus day
      INDIGENOUS:       month_week_dow(Date.OCTOBER, 2, Date.MONDAY),
      VETERANS:         month_day(Date.NOVEMBER, 11),
      THANKSGIVING_EVE: month_week_dow(Date.NOVEMBER, 4, Date.WEDNESDAY),
      THANKSGIVING:     month_week_dow(Date.NOVEMBER, 4, Date.THURSDAY),
      THANKSGIVING_FRI: month_week_dow(Date.NOVEMBER, 4, Date.FRIDAY, 1),
      CHRISTMAS_EVE:    month_day(Date.DECEMBER, 24),
      CHRISTMAS:        month_day(Date.DECEMBER, 25),
      CHRISTMAS_WEEK:   function(d) { return d.getMonth() == Date.DECEMBER && d.getDate() > 25; },
      NEW_YEAR_EVE:     month_day(Date.DECEMBER, 31)
    };
  }());

  // and some conditions we can use. some can be used directly; some are
  // functions which return conditions. hopefully it is obvious which are
  // which.
  var always = function() { return true; },
  never = function() { return false; },
  weekend = function(date) {
    return date.is().sat() || date.is().sun();
  },
  weekday = function(date) {
    return date.is().weekday();
  },
  fridays = function(date) {
    return date.is().fri();
  },
  saturdays = function(date) {
    return date.is().sat();
  },
  sundays = function(date) {
    return date.is().sun();
  },
  rush_hour = function(start_time, end_time, days) {
    var start = start_time[0] * 60 + start_time[1],
    finish = end_time[0] * 60 + end_time[1];
    days = days || always;
    return function(date) {
      var h = date.getHours(), m = date.getMinutes(), hm = h*60 + m;
      return days(date) && (hm >= start && hm < finish);
    };
  },
  holiday = function() {
    var holidays = _(arguments);
    return function(date) {
      return holidays.any(function(h) { return h(date); });
    };
  },
  // Friday before Memorial Day through Labor Day
  summer = function(filter) {
    return function(date) {
      var month, day, dow, cutoff;

      if (!filter(date))
        return false;

      month = date.getMonth();

      if (month < Date.MAY || month > Date.SEPTEMBER)
        return false;
      else if (month > Date.MAY && month < Date.SEPTEMBER)
        return true;

      day = date.getDate();
      dow = date.getDay();

      if (month === Date.MAY) {
        dow = dow || 7;
        return (day - dow) >= 24;
      } else { /* must be September */
        cutoff = dow - 1;
        if (cutoff <= 0)
          cutoff += 7;

        return day <= cutoff;
      }
    };
  };

  that.Conditions = {
    always: always,
    never: never,
    weekend: weekend,
    weekday: weekday,
    rush_hour: rush_hour,
    holiday: holiday,
    summer: summer
  };

  var trivial_system = function(name, f) {
    return {
      name: name,
      available: f,
      slug: name.slugify()
    };
  };

  var bidi_system = function(name, f) {
    return {
      name: name,
      available: f,
      slug: name.slugify()
    };
  };

  // OK! Define the systems we know about
  var TRANSIT_SYSTEMS = [
    trivial_system("NYC Subway", always),
    trivial_system("NYC Bus", never),
    trivial_system("Amtrak", never),
    trivial_system("PATH", conditions(
                     accept(weekend),
                     // transalt says ok on holidays. path website is unclear.
                     // let's assume that "weekdays" does not include those
                     // holidays when a weekend schedule operates.
                     accept(holiday(Holidays.NEW_YEAR, Holidays.PRESIDENTS, Holidays.MEMORIAL, Holidays.LABOR, Holidays.THANKSGIVING, Holidays.CHRISTMAS)),
                     reject(rush_hour([ 6, 30], [ 9, 30])),
                     reject(rush_hour([15, 30], [18, 30])),
                     always
                   )),
    bidi_system("Metro-North", conditions(
                  reject(holiday(Holidays.NEW_YEAR, Holidays.ST_PATRICK, Holidays.MOTHER, Holidays.EREV_ROSH, Holidays.EREV_YOM, Holidays.THANKSGIVING_EVE, Holidays.THANKSGIVING, Holidays.CHRISTMAS_EVE, Holidays.NEW_YEAR_EVE)),
                  reject(rush_hour([12, 00], [20, 30], holiday(Holidays.MEMORIAL_FRI, Holidays.JULY_3, Holidays.LABOR_FRI)), OUTBOUND),
                  accept(weekend),
                  reject(rush_hour([16, 00], [20, 00]), OUTBOUND),
                  reject(rush_hour([ 5, 30], [12, 00], holiday(Holidays.THANKSGIVING_FRI, Holidays.CHRISTMAS_WEEK)), OUTBOUND),
                  reject(rush_hour([15, 00], [20, 30], holiday(Holidays.THANKSGIVING_FRI, Holidays.CHRISTMAS_WEEK)), OUTBOUND),
                  maybe (rush_hour([ 5, 30], [ 9, 00]), OUTBOUND),
                  maybe (rush_hour([15, 00], [16, 00]), OUTBOUND),
                  maybe (rush_hour([20, 00], [20, 15]), OUTBOUND),
                  // inbound is arrival time at GCT, not departure time, ick.
                  reject(rush_hour([ 5, 00], [10, 00]), INBOUND),
                  // "and on other trains identified in Metro-North timetables"
                  reject(rush_hour([ 5, 00], [12, 00], holiday(Holidays.THANKSGIVING_FRI, Holidays.CHRISTMAS_WEEK)), INBOUND),
                  reject(rush_hour([16, 00], [20, 00], holiday(Holidays.THANKSGIVING_FRI, Holidays.CHRISTMAS_WEEK)), INBOUND),
                  always
                )),
    bidi_system("Long Island Rail Road", conditions(
                  reject(holiday(Holidays.NEW_YEAR, Holidays.ST_PATRICK, Holidays.MOTHER, Holidays.GOOD_FRIDAY, Holidays.EASTER, Holidays.MEMORIAL_FRI, Holidays.MEMORIAL, Holidays.JULY_3, Holidays.JULY_4, Holidays.EREV_ROSH, Holidays.EREV_YOM, Holidays.LABOR_FRI, Holidays.LABOR, Holidays.INDIGENOUS, Holidays.THANKSGIVING_EVE, Holidays.THANKSGIVING, Holidays.THANKSGIVING_FRI, Holidays.CHRISTMAS_EVE, Holidays.CHRISTMAS, Holidays.NEW_YEAR_EVE)),
                  // reject "Special Events - including Belmont and
                  // Mets-Willets Point trains, US Golf Open or NYC
                  // parade day trains, the 'Montauk Century' and the
                  // 'Ride to Montauk' annual events."

                  // inbound arrival times are at Penn Sta., ick.
                  reject(rush_hour([ 6, 00], [10, 00], weekday),   INBOUND),
                  reject(rush_hour([15, 00], [20, 00], weekday),   OUTBOUND),
                  reject(rush_hour([ 7, 00], [10, 00], saturdays), INBOUND),
                  reject(rush_hour([16, 00], [18, 00], saturdays), OUTBOUND),
                  reject(rush_hour([17, 00], [20, 00], sundays),   INBOUND),
                  reject(rush_hour([22, 00], [24, 00], sundays),   OUTBOUND),
                  maybe (rush_hour([18, 00], [22, 00], summer(sundays), INBOUND)),
                  maybe (rush_hour([15, 00], [21, 00], summer(fridays), OUTBOUND)),
                  maybe (summer(saturdays)),
                  always
                )),
    bidi_system("NJ Transit Trains", conditions(
                  // NJT defines "Major Holiday", then includes "the
                  // day prior to a holiday." Do they really mean the
                  // Sunday before Memorial and Labor days?
                  reject(holiday(Holidays.NEW_YEAR, Holidays.MEMORIAL, Holidays.JULY_3, Holidays.JULY_4, Holidays.LABOR, Holidays.EREV_ROSH, Holidays.EREV_YOM, Holidays.THANKSGIVING_EVE, Holidays.THANKSGIVING, Holidays.THANKSGIVING_FRI, Holidays.CHRISTMAS_EVE, Holidays.CHRISTMAS, Holidays.NEW_YEAR_EVE)),
                  accept(weekend),
                  reject(rush_hour([ 6, 00], [10, 00]), INBOUND),
                  reject(rush_hour([16, 00], [17, 00]), OUTBOUND),
                  always
                )),
    trivial_system("NJ Transit Buses", maybe(always))
  ],

  // allow to quickly get a transit system by its slug
  TRANSIT_SYSTEMS_LOOKUP = _(TRANSIT_SYSTEMS).foldl(
    function(memo, system) {
      memo[system.slug] = system;
      return memo;
    },
    { }
  ),

  PAGE_TITLE = "Ride with Bikes";
  that.Systems = TRANSIT_SYSTEMS_LOOKUP;

  var setstateforsystem = function(slug, mode) {
    if (!mode)
      mode = 'pushState'; // other sensible choice is 'replaceState'

    if (slug && TRANSIT_SYSTEMS_LOOKUP[slug]) {
      var system = TRANSIT_SYSTEMS_LOOKUP[slug];
      History[mode]({system: system.slug}, PAGE_TITLE + ' | ' + system.name, '?system=' + system.slug);
    } else {
      History[mode](null, PAGE_TITLE, '');
    }
  };

  var setsystem = function(slug, fade) {
    var $result = $("#result"), $getstarted = $("#getstarted");
    $result.hide();

    $("#transitsystem").val(slug);
    
    if (!slug) {
      $getstarted.show();
      History.pushState(null, null, '');
      return;
    }

    var system = TRANSIT_SYSTEMS_LOOKUP[slug];
    if (!system) {
      alert("Error! Unknown system " + slug);
      return;
    }

    if (fade === undefined)
      fade = true;

    var when = new Date(), avail = system.available(when);
    $(".result-h").hide();
    $("#result-" + avail).show();

    $(".result-notes").hide();
    $("#notes-" + slug).show();
    $("#" + slug + "-maybe")[avail === 'maybe' ? 'show' : 'hide']();
    $("#date-time").text("at " + when.toString('m') + ', ' + when.toString('t'));

    $getstarted.hide();
    $result.fadeIn('slow');
  };

  $(function() {
    var $select = $("#transitsystem");
    _(TRANSIT_SYSTEMS).chain().sortBy(function(system){
      return system.name.toLowerCase();
    }).each(function(system, i) {
      $select.append($("<option/>", {text: system.name, value: system.slug}));
    });

    $select.bind("click change", function() {
      setstateforsystem($select.val());
    });

    $(window).bind("statechange", function() {
      var state = History.getState();
      setsystem(state.data ? state.data.system : undefined);
    });
  });

  return that;
})(jQuery, _, window);