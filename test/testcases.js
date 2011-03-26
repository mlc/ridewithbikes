$(function() {
  test("Slugify", function() {
    equal("hello".slugify(), "hello");
    equal("Hello".slugify(), "hello");
    equal("Hello There".slugify(), "hello-there");
    equal("Testing 123".slugify(), "testing-123");
    equal("Oh boy! THIS    -    is ExCiTiNg".slugify(), "oh-boy-this-is-exciting");
  });

  module("Holidays");
  var Holidays = Transit.Holidays;

  var check_holiday = function(holiday, date, p) {
    equal(Holidays[holiday](Date.parse(date)), p, date);
  };

  // simple holiday, July 4 every year
  test("July 4", function() {
    check_holiday('JULY_4', "July 4, 2011", true);
    check_holiday('JULY_4', "July 5, 2011", false);
    check_holiday('JULY_4', "May 4, 2011", false);
    check_holiday('JULY_4', "July 4, 2012", true);
  });

  // 4th Thursday in November
  test("Thanksgiving", function() {
    check_holiday('THANKSGIVING', "November 24, 2011", true);
    check_holiday('THANKSGIVING', "November 18, 2011", false);
    check_holiday('THANKSGIVING', "November 25, 2011", false);
    check_holiday('THANKSGIVING', "October 28, 2011", false);
    check_holiday('THANKSGIVING', "November 22, 2012", true);
    check_holiday('THANKSGIVING', "November 29, 2012", false);
  });

  // Day after 4th Thursday in November
  // (in e.g. 2013, not equal to 4th Friday in November)
  test("Day after Thanksgiving", function() {
    check_holiday('THANKSGIVING_FRI', "November 25, 2011", true);
    check_holiday('THANKSGIVING_FRI', "November 19, 2011", false);
    check_holiday('THANKSGIVING_FRI', "November 26, 2011", false);
    check_holiday('THANKSGIVING_FRI', "October 29, 2011", false);
    check_holiday('THANKSGIVING_FRI', "November 29, 2013", true);
    check_holiday('THANKSGIVING_FRI', "November 22, 2013", false);
  });

  // last Monday in May
  // (in eg 2011, not equal to 4th Monday in May)
  test("Memorial Day", function() {
    check_holiday('MEMORIAL', "May 30, 2011", true);
    check_holiday('MEMORIAL', "May 31, 2011", false);
    check_holiday('MEMORIAL', "May 23, 2011", false);
    check_holiday('MEMORIAL', "March 28, 2011", false);
    check_holiday('MEMORIAL', "May 28, 2012", true);
    check_holiday('MEMORIAL', "May 21, 2012", false);
  });

  // Friday before last Monday in May
  test("Friday before Memorial Day", function() {
    check_holiday('MEMORIAL_FRI', "May 27, 2011", true);
    check_holiday('MEMORIAL_FRI', "May 28, 2011", false);
    check_holiday('MEMORIAL_FRI', "May 20, 2011", false);
    check_holiday('MEMORIAL_FRI', "March 25, 2011", false);
    check_holiday('MEMORIAL_FRI', "May 25, 2012", true);
    check_holiday('MEMORIAL_FRI', "May 28, 2012", false);
  });

  // Friday before 1st Monday in Sep is sometimes in Aug!
  test("Friday before Labor Day", function() {
    check_holiday('LABOR_FRI', "Sep 2, 2011", true);
    check_holiday('LABOR_FRI', "Aug 31, 2012", true);
    check_holiday('LABOR_FRI', "Aug 28, 2015", false);
    check_holiday('LABOR_FRI', "Sep 7, 2012", false);
  });

  // 1st Tishrei
  test("Erev Rosh Hashana", function() {
    check_holiday('EREV_ROSH', "Sep 28, 2011", true);
    check_holiday('EREV_ROSH', "Sep 29, 2011", false);
    check_holiday('EREV_ROSH', "Sep 28, 2012", false);
    check_holiday('EREV_ROSH', "Sep 16, 2012", true);
  });


  module("Conditions");
  var Conditions = Transit.Conditions;
  var check_condition = function(condition, date, p) {
    equal(Conditions[condition](Date.parse(date)), p, date + " " + condition);
  };

  test("always and never", function() {
    check_condition("always", "now", true);
    check_condition("never", "now", false);
  });

  test("weekend and weekday", function() {
    check_condition("weekday", "next Wednesday", true);
    check_condition("weekday", "next Saturday", false);
    check_condition("weekend", "next Wednesday", false);
    check_condition("weekend", "next Saturday", true);
  });

  test("Rush Hour", function() {
    var path_am_rush = Conditions.rush_hour([6, 30], [9, 30]);
    var check_path = function(date, p) {
      equal(path_am_rush(Date.parse(date)), p, date);
    };
    check_path("6:30 AM", true);
    check_path("7:30 AM", true);
    check_path("9:30 AM", false);
    check_path("12:30 PM", false);
    check_path("7:30 PM", false);
  });

  test("Holidays", function() {
    var path_holiday = Conditions.holiday(Holidays.NEW_YEAR, Holidays.PRESIDENTS, Holidays.MEMORIAL, Holidays.LABOR, Holidays.THANKSGIVING, Holidays.CHRISTMAS);
    ok(path_holiday(Date.parse("January 1, 2011")), "New Year holiday");
    ok(path_holiday(Date.parse("November 24, 2011")), "Thanksgiving holiday");
    ok(!path_holiday(Date.parse("July 4, 2011")), "July 4 NOT holiday");
  });

  test("Summer", function() {
    // there are a lot of testcases here, because this was a pain to write.
    var summer = Conditions.summer(Conditions.always);
    var check_summer = function(date, p) {
      equal(summer(Date.parse(date)), p, date);
    };
    check_summer("Apr 30, 2011", false);
    check_summer("May 24, 2009", false);
    check_summer("May 25, 2009", true);
    check_summer("May 26, 2009", true);
    check_summer("May 31, 2009", true);
    check_summer("May 28, 2010", false);
    check_summer("May 30, 2010", false);
    check_summer("May 31, 2010", true);
    check_summer("May 28, 2011", false);
    check_summer("May 30, 2011", true);
    check_summer("May 31, 2011", true);
    check_summer("Jul 1, 2011", true);
    check_summer("Sep 1, 2008", true);
    check_summer("Sep 2, 2008", false);
    check_summer("Sep 1, 2011", true);
    check_summer("Sep 4, 2011", true);
    check_summer("Sep 5, 2011", true);
    check_summer("Sep 6, 2011", false);
    check_summer("Oct 1, 2011", false);
    ok(!(Conditions.summer(Conditions.weekend))(Date.parse("Jul 1, 2011")), "guard");
  });

  module("Systems");

  // some systems do not depend on the time of day.
  test("Trivial systems", function() {
    var subway = Transit.systems['nyc-subway'], bus = Transit.systems['nyc-bus'], njbus = Transit.systems['nj-transit-buses'];
    ok(subway.available(new Date()), 'subway is always available');
    ok(!bus.available(new Date()), 'bus is never available');
    equal(njbus.compute(new Date()), 'maybe', 'NJT bus is unpredictable');
  });

  // PATH is the simplest nontrivial system.
  test("PATH", function() {
    expect(8);
    var path = Transit.systems.path;
    var check_path = function(date, p, descr) {
      equal(path.compute(Date.parse(date)), String(p), descr || date);
    };
    equal(path.name, "PATH", "name");
    equal(path.slug, "path", "slug");
    check_path("March 26, 2011 7:30 AM", true, "saturday morning");
    check_path("March 22, 2011 7:30 AM", false, "tuesday morning");
    check_path("March 22, 2011 10:30 AM", true);
    check_path("March 22, 2011 5:30 PM", false);
    check_path("March 22, 2011 9:30 PM", true);
    check_path("May 30, 2011 7:30 AM", true, "memorial day");
  });

  var ONLY_INBOUND = "inbound ok, but not outbound",
      ONLY_OUTBOUND = "outbound ok, but not inbound";

  // Metro-North is all kinds of strange.
  test("Metro-North", function() {
    var mnr = Transit.systems["metro-north"],
    check = function(date, p, descr) {
      equal(mnr.compute(Date.parse(date)).toString().toLowerCase(), p.toString(), descr || date);
    };
    check("Mar 29, 2011 12:00 PM", true);
    check("Mar 29, 2011 6:00 PM", ONLY_INBOUND, "pm rush");
    _(["8:12 PM", "3:32 PM"]).each(function(t) {
      check("Mar 29, 2011 " + t, "inbound ok; maybe outbound", t);
    });
    check("Mar 29, 2011 8:20 PM", true, "normal 8:20pm");
    check("Nov 25, 2011 3:13 PM", ONLY_INBOUND, "post-thanksgiving");
    check("Dec 29, 2011 8:20 PM", ONLY_INBOUND, "post-xmas 8:20pm");
    check("Mar 29, 2011 5:15 AM", ONLY_OUTBOUND, "early am rush");
    check("Mar 29, 2011 6:17 AM", "maybe outbound; inbound not ok", "bidi am rush");
    check("Mar 29, 2011 9:15 AM", ONLY_OUTBOUND, "late am rush");
    check("Nov 25, 2011 6:00 PM", false, "post-thanksgiving pm rush");
    check("Mar 29, 2011 11:00 AM", true, "late am");
    check("Nov 25, 2011 11:00 AM", false, "post-thanksgiving late am");
    check("Mar 17, 2011 12:00 PM", false, "holiday");
    check("Mar 29, 2011 12:30 PM", true, "normal early afternoon");
    check("May 27, 2011 12:30 PM", ONLY_INBOUND, "fri before memorial day early afternoon");
    check("May 27, 2011 11:30 AM", true, "fri before memorial day 11:30a");
    check("Mar 26, 2011 6:00 PM", true, "weekend");
  });

  // omg who comes up with this shit?
  test("Long Island RR", function() {
    var lirr = Transit.systems["long-island-rail-road"],
    check = function(date, p, descr) {
      equal(lirr.compute(Date.parse(date)).toString().toLowerCase(), p.toString(), descr + " — " + date);
    };

    equal(lirr.name, "Long Island Rail Road", "weird name spelling");
    check("Mar 29, 2011 12:00 PM", true, "mid-day");
    check("Mar 29, 2011 6:30 AM", ONLY_OUTBOUND, "am rush");
    check("Mar 29, 2011 8:00 AM", ONLY_OUTBOUND, "am rush");
    check("Mar 29, 2011 5:00 PM", ONLY_INBOUND, "pm rush");
    check("Mar 29, 2011 7:00 PM", ONLY_INBOUND, "pm rush");
    check("Mar 26, 2011 6:30 AM", true, "sat early am");
    check("Mar 26, 2011 8:00 AM", ONLY_OUTBOUND, "sat am rush");
    check("Mar 26, 2011 5:00 PM", ONLY_INBOUND, "sat pm rush");
    check("Mar 26, 2011 7:00 PM", true, "sat pm ok");
    check("Mar 27, 2011 8:00 AM", true, "sunday morning");
    check("Mar 27, 2011 7:00 PM", ONLY_OUTBOUND, "sun weridness");
    check("Mar 27, 2011 9:00 PM", true, "sunday");
    check("Mar 27, 2011 11:00 PM", ONLY_INBOUND, "sun weridness");
    check("Jun 19, 2011 9:00 PM", "outbound ok; maybe inbound", "montauk summer sun");
    check("Jun 19, 2011 7:00 PM", ONLY_OUTBOUND, "montauk summer sun"); // right?
    check("Mar 25, 2011 8:30 PM", true, "normal fri");
    check("Jun 17, 2011 8:30 PM", "inbound ok; maybe outbound", "montauk summer fri");
    check("Jun 18, 2011 12:00 PM", "maybe", "montauk summer sat");
    check("Jun 18, 2011 8:00 AM", "maybe outbound; inbound not ok", "montauk summer sat am");
    check("Jun 18, 2011 5:00 PM", "maybe inbound; outbound not ok", "montauk summer sat pm");
    check("May 8, 2011 12:00 PM", false, "mother's day");
  });
});
