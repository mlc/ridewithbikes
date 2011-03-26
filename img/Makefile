all : sprites.png

sprites.png : approve.png bike.png bus.png disapprove.png inbound.png outbound.png question.png train.png x.png
	convert $^ +append $@
	optipng $@
