/*
 * code behind Ride with Bikes.
 * 
 * Copyright © 2011 Mike Castleman.
 * 
 * This program is free software. It comes without any warranty, to
 * the extent permitted by applicable law. You can redistribute it
 * and/or modify it under the terms of the Do What The Fuck You Want
 * To Public License, Version 2, as published by Sam Hocevar. See
 * http://sam.zoy.org/wtfpl/COPYING for more details.
 */

String.prototype.slugify = function() {
  return this.toLowerCase().replace(/[^A-Z0-9]+/gi, '-');
};

(function(_, window, undefined) {
  var that = {};

  // some functions which return functions, hooray.
  // awesomely, checker is a function which returns a function which itself
  // returns a function. (currying, anyone?)
  var checker = function(result) {
    return function(condition, fdir) {
      return function(date, direction) {
        if ((!fdir || direction == fdir) && condition(date))
          return result;
        else
          return undefined;
      };
    };
  },
  reject = checker(false),
  accept = checker(true),
  maybe  = checker('maybe'),
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
      JULY_3:           month_day(Date.JULY, 3),
      // "the weekday before Independence Day".
      JULY_3_LIRR:      function(d) {
        var month = d.getMonth(), day = d.getDate();
        return (month === Date.JULY) && ((day === 3 && d.is().weekday()) || (day < 4 && d.is().friday()));
      },
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
        return day >= (dow+2)%7 + 22;
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

  // this is sort of a type system, but a very simple one.
  var System = (function() {
    var friendly_string = function(obj) {
      switch(obj) {
      case 'true':
      case true:
        return 'Yes';
      case 'false':
      case false:
        return 'No';
      default:
        return obj.toString();
      }
    },
    summarize_results = function() {
      if (this.maybe) {
        if (this['true']) {
          return this['true'].join(', ') + " ok; maybe " + this['maybe'].join(', ');
        } else {
          return "maybe " + this['maybe'].join(', ') + "; " + this['false'].join(', ') + " not ok";
        }
      } else {
        return this['true'].join(', ') + " ok, but not " + this['false'].join(', ');
      }
    },
    summarize_table = function(table) {
      var result = [], i, len = table.length, memo = table[0];
      if (len === 0)
        return [];
      for (i = 1; i < len; ++i) {
        if (!_.isEqual(memo.slice(1), table[i].slice(1))) {
          result.push([memo[0] + ' \u2013 ' + table[i][0]].concat(memo.slice(1)));
          memo = table[i];
        }
      }
      result.push([memo[0] + ' \u2013 midnight'].concat(memo.slice(1)));
      if (result.length === 1)
        result[0][0] = "all day";
      return result;
    };


    var base_sys = function(name, icon, f) {
      return {
        name: name,
        available: f,
        icon: icon,
        slug: name.slugify(),
        table: function(date) {
          var d = date.clone(), i, result = [], that = this, row;
          d.clearTime(); // set to midnight.
          for (i = 0; i < 24*4; ++i, d.addMinutes(15)) {
            row = _(that.states).map(function(state) { return that.available(d, state); });
            row.unshift(d.toString('t'));
            result.push(row);
          }

          return result;
        },
        friendly_table: function(date) {
          return summarize_table(this.table(date));
        }
      };
    };

    return {
      trivial: function() {
        var that = base_sys.apply(this, arguments);
        that.states = ['all'];
        that.show_whole_day = !arguments[3];
        that.compute = that.available;
        return that;
      },
      bidi: function() {
        var that = base_sys.apply(this, arguments);
        that.states = ['inbound', 'outbound'];
        that.show_whole_day = true;
        that.compute = function(date) {
          var that = this;
          var results = {}, groupedresults = {};
          _(this.states).each(function(state) {
            results[state] = that.available(date, state);
          });
          _(results).each(function(k, v) {
            if (_.isArray(groupedresults[k])) {
              groupedresults[k].push(v);
            } else {
              groupedresults[k] = [v];
            }
          });

          switch(_(groupedresults).size()) {
          case 0:
            throw 'wtf? no results?';
            break;
          case 1:
            return _(groupedresults).keys()[0];

          default:
            groupedresults.toString = summarize_results;
            return groupedresults;
          }
        };
        return that;
      },
      friendly_string: friendly_string,
      summarize: summarize_table
    };
  }());
  that.System = System;

  // OK! Define the systems we know about
  var TRANSIT_SYSTEMS = [
    System.trivial("NYC Subway", "train", always, true),
    System.trivial("NYC Bus", "bus", never, true),
    System.trivial("Amtrak", "train", never, true),
    System.trivial("PATH", "train", conditions(
                     accept(weekend),
                     // transalt says ok on holidays. path website is unclear.
                     // let's assume that "weekdays" does not include those
                     // holidays when a weekend schedule operates.
                     accept(holiday(Holidays.NEW_YEAR, Holidays.PRESIDENTS, Holidays.MEMORIAL, Holidays.LABOR, Holidays.THANKSGIVING, Holidays.CHRISTMAS)),
                     reject(rush_hour([ 6, 30], [ 9, 30])),
                     reject(rush_hour([15, 30], [18, 30])),
                     always
                   )),
    System.bidi("Metro-North", "train", conditions(
                  reject(holiday(Holidays.NEW_YEAR, Holidays.ST_PATRICK, Holidays.MOTHER, Holidays.EREV_ROSH, Holidays.EREV_YOM, Holidays.THANKSGIVING_EVE, Holidays.THANKSGIVING, Holidays.CHRISTMAS_EVE, Holidays.NEW_YEAR_EVE)),
                  reject(rush_hour([12, 00], [20, 30], holiday(Holidays.MEMORIAL_FRI, Holidays.JULY_3, Holidays.LABOR_FRI)), 'outbound'),
                  accept(weekend),
                  reject(rush_hour([16, 00], [20, 00]), 'outbound'),
                  reject(rush_hour([ 5, 30], [12, 00], holiday(Holidays.THANKSGIVING_FRI, Holidays.CHRISTMAS_WEEK)), 'outbound'),
                  reject(rush_hour([15, 00], [20, 30], holiday(Holidays.THANKSGIVING_FRI, Holidays.CHRISTMAS_WEEK)), 'outbound'),
                  maybe (rush_hour([ 5, 30], [ 9, 00]), 'outbound'),
                  maybe (rush_hour([15, 00], [16, 00]), 'outbound'),
                  maybe (rush_hour([20, 00], [20, 15]), 'outbound'),
                  // inbound is arrival time at GCT, not departure time, ick.
                  reject(rush_hour([ 5, 00], [10, 00]), 'inbound'),
                  // "and on other trains identified in Metro-North timetables"
                  reject(rush_hour([ 5, 00], [12, 00], holiday(Holidays.THANKSGIVING_FRI, Holidays.CHRISTMAS_WEEK)), 'inbound'),
                  reject(rush_hour([16, 00], [20, 00], holiday(Holidays.THANKSGIVING_FRI, Holidays.CHRISTMAS_WEEK)), 'inbound'),
                  always
                )),
    System.bidi("Long Island Rail Road", "train", conditions(
                  reject(holiday(Holidays.NEW_YEAR, Holidays.ST_PATRICK, Holidays.MOTHER, Holidays.GOOD_FRIDAY, Holidays.EASTER, Holidays.MEMORIAL_FRI, Holidays.MEMORIAL, Holidays.JULY_3_LIRR, Holidays.JULY_4, Holidays.EREV_ROSH, Holidays.EREV_YOM, Holidays.LABOR_FRI, Holidays.LABOR, Holidays.INDIGENOUS, Holidays.THANKSGIVING_EVE, Holidays.THANKSGIVING, Holidays.THANKSGIVING_FRI, Holidays.CHRISTMAS_EVE, Holidays.CHRISTMAS, Holidays.NEW_YEAR_EVE)),
                  // reject "Special Events - including Belmont and
                  // Mets-Willets Point trains, US Golf Open or NYC
                  // parade day trains, the 'Montauk Century' and the
                  // 'Ride to Montauk' annual events."

                  // inbound arrival times are at Penn Sta., ick.
                  reject(rush_hour([ 6, 00], [10, 00], weekday),   'inbound'),
                  reject(rush_hour([15, 00], [20, 00], weekday),   'outbound'),
                  reject(rush_hour([ 7, 00], [10, 00], saturdays), 'inbound'),
                  reject(rush_hour([16, 00], [18, 00], saturdays), 'outbound'),
                  reject(rush_hour([17, 00], [20, 00], sundays),   'inbound'),
                  reject(rush_hour([22, 00], [24, 00], sundays),   'outbound'),
                  maybe (rush_hour([18, 00], [22, 00], summer(sundays)), 'inbound'),
                  maybe (rush_hour([15, 00], [21, 00], summer(fridays)), 'outbound'),
                  maybe (summer(saturdays)),
                  always
                )),
    System.bidi("NJ Transit Trains", "train", conditions(
                  // NJT defines "Major Holiday", then includes "the
                  // day prior to a holiday." Do they really mean the
                  // Sunday before Memorial and Labor days?
                  reject(holiday(Holidays.NEW_YEAR, Holidays.MEMORIAL, Holidays.JULY_3, Holidays.JULY_4, Holidays.LABOR, Holidays.EREV_ROSH, Holidays.EREV_YOM, Holidays.THANKSGIVING_EVE, Holidays.THANKSGIVING, Holidays.THANKSGIVING_FRI, Holidays.CHRISTMAS_EVE, Holidays.CHRISTMAS, Holidays.NEW_YEAR_EVE)),
                  accept(weekend),
                  reject(rush_hour([ 6, 00], [10, 00]), 'inbound'),
                  reject(rush_hour([16, 00], [19, 00]), 'outbound'),
                  always
                )),
    System.trivial("NJ Transit Buses", "bus", maybe(always), true),
    System.trivial("Staten Island Ferry", "ferry", always, true)
  ];

  that.systems = _(TRANSIT_SYSTEMS).foldl(
    function(memo, system) {
      memo[system.slug] = system;
      return memo;
    },
    { }
  );

  window.Transit = that;
})(_, this);
