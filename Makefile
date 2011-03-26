SUBDIRS = img js

all : subdirs

.PHONY: all subdirs $(SUBDIRS)

subdirs : $(SUBDIRS)

$(SUBDIRS):
	$(MAKE) -C $@