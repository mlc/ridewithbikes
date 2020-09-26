SUBDIRS = img js

all : subdirs

.PHONY: all subdirs sync $(SUBDIRS)

subdirs : $(SUBDIRS)

$(SUBDIRS):
	$(MAKE) -C $@

sync:
	rclone -P --filter-from filters.txt sync . s3:ridewithbikes.com/
