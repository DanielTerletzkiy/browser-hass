.PHONY: release
LEVEL ?= patch

release:
	@VERSION=$$(grep -oP '(?<="version": ")[^"]+' custom_components/browser_hass/manifest.json); \
	MAJOR=$$(echo $$VERSION | cut -d. -f1); \
	MINOR=$$(echo $$VERSION | cut -d. -f2); \
	PATCH=$$(echo $$VERSION | cut -d. -f3); \
	if [ "$(LEVEL)" = "major" ]; then MAJOR=$$((MAJOR+1)); MINOR=0; PATCH=0; \
	elif [ "$(LEVEL)" = "minor" ]; then MINOR=$$((MINOR+1)); PATCH=0; \
	else PATCH=$$((PATCH+1)); \
	fi; \
	NEW_VERSION="$$MAJOR.$$MINOR.$$PATCH"; \
	echo "Bumping to $$NEW_VERSION"; \
	sed -i 's/"version": "[^"]*"/"version": "'$$NEW_VERSION'"/' custom_components/browser_hass/manifest.json; \
	sed -i 's/"version": "[^"]*"/"version": "'$$NEW_VERSION'"/' public/manifest.json; \
	sed -i 's/"version": "[^"]*"/"version": "'$$NEW_VERSION'"/' public/manifest.firefox.json; \
	git add custom_components/browser_hass/manifest.json public/manifest.json public/manifest.firefox.json; \
	git commit -m "chore(release): v$$NEW_VERSION"; \
	git tag -a v$$NEW_VERSION -m "Release v$$NEW_VERSION"; \
	echo "Tagged v$$NEW_VERSION"
