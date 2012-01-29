SCRIPTS = underscore.ugly.js date.ugly.js history.adapter.jquery.ugly.js history.ugly.js history.html4.ugly.js transit.ugly.js transit-ui.ugly.js

# maybe change this?
UGLIFY = uglifyjs

all : scripts.min.js

scripts.min.js : $(SCRIPTS)
	cat $^ > $@

%.ugly.js : %.js
	$(UGLIFY) $< > $@
	echo ';' >> $@

clean :
	rm -f *.ugly.js
