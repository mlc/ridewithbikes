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
  test("NYC Transit", function() {
    var subway = Transit.Systems['nyc-subway'], bus = Transit.Systems['nyc-bus'];
    ok(subway.available(new Date()), 'subway is always available');
    ok(!bus.available(new Date()), 'bus is never available');
  });

  test("PATH", function() {
    expect(8);
    var path = Transit.Systems.path;
    var check_path = function(date, p, descr) {
      equal(path.available(Date.parse(date)), p, descr || date);
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
});
