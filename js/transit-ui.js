(function($, _, window, undefined) {
  var History = window.History, Transit = window.Transit;

  var PAGE_TITLE = "Ride with Bikes";

  var show_error = function(txt) {
    $("#error-text").text(txt);
    $("#error").show();
  };

  var setstateforsystem = function(slug, mode) {
    if (!mode)
      mode = 'pushState'; // other sensible choice is 'replaceState'

    if (slug && Transit.systems[slug]) {
      var system = Transit.systems[slug];
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

    var system = Transit.systems[slug];
    if (!system) {
      show_error("Unknown system " + slug);
      return;
    }

    var when = Date.parse($("#when").val());
    if (!when) {
      show_error("I don't understand that time.");
      return;
    }

    $("#error").hide();

    var results = system.compute(when), avail;
    $(".result-notes, .method-icon, .result-icon").hide();
    $("#date-time").text("at " + when.toString('m') + ', ' + when.toString('t'));
    $("#icon-" + system.icon).show();
    $("#notes-" + slug).show();

    if (typeof results === 'object') {
      if (_(results['true']).include('inbound')) {
          $(".result-inbound").show();
      }
      if (_(results['true']).include('outbound')) {
          $(".result-outbound").show();
      }
      $("#result-h").text(results.toString());
      if (results.maybe) {
        $("#" + slug + "-maybe").show();
        $(".result-maybe").show();
      } else {
        $("#" + slug + "-maybe").hide();
      }
    } else {
      // just one status!
      $(".result-" + results).show();
      $("#" + slug + "-maybe")[avail === 'maybe' ? 'show' : 'hide']();
      $("#result-h").text(Transit.System.friendly_string(results));
    }

    $getstarted.hide();
    if (fade) {
      $result.fadeIn('slow');
    } else {
      $result.show();
    }
  };

  $(function() {
    var $select = $("#transitsystem");
    _(Transit.systems).chain().sortBy(function(system){
      return system.name.toLowerCase();
    }).each(function(system, i) {
      $select.append($("<option/>", {text: system.name, value: system.slug}));
    });

    var setsystemonce = _.throttle(function(system) {
      setsystem(system, true);
    }, 50);

    $select.bind("change", function() {
      var system = $select.val();
      setstateforsystem($select.val());
      setsystemonce(system);
    });

    $("#when").bind("keyup change", _.debounce(function() {
      setsystem($select.val(), false);
    }, 250));

    $(window).bind("statechange", function() {
      var state = History.getState(), system = state.data ? state.data.system : undefined;
      $select.val(system || '');
      setsystemonce(system);
    });

    if (!_(["EST", "EDT"]).include(new Date().getTimezone())) {
      $("#wrongtimezone").removeClass("hidden");
    }

    History.getState(); // called for its side effects.
  });
}(jQuery, _, this));