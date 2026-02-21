.PHONY: install run clean

install:
	npm install --legacy-peer-deps
	npx @electron/rebuild

run:
	npm start

clean:
	rm -rf node_modules
	rm -rf dist
	rm -f package-lock.json
	rm -rf ~/Library/Application\ Support/orbit
