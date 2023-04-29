emulator:
	cd emulator && overmind start

ecr-login:
	aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 547201571710.dkr.ecr.us-west-2.amazonaws.com

.PHONY: emulator ecr-login
