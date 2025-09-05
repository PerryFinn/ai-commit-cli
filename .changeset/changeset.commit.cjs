
//#region scripts/changeset.commit.ts
const getAddMessage = async (changeset, options) => {
	const skipCI = (options === null || options === void 0 ? void 0 : options.skipCI) === "add" || (options === null || options === void 0 ? void 0 : options.skipCI) === true;
	const skipMsg = skipCI ? "\n\n[skip ci]\n" : "";
	return `docs(changeset): ${changeset.summary}${skipMsg}`;
};
const getVersionMessage = async (releasePlan, options) => {
	const skipCI = (options === null || options === void 0 ? void 0 : options.skipCI) === "version" || (options === null || options === void 0 ? void 0 : options.skipCI) === true;
	const publishableReleases = releasePlan.releases.filter((release) => release.type !== "none");
	const numPackagesReleased = publishableReleases.length;
	if (publishableReleases.length === 1) {
		const release = publishableReleases[0];
		if (!release) throw new Error("release info is undefined");
		return `chore(release): ${release.name}@${release.newVersion}`;
	}
	const releasesLines = publishableReleases.map((release) => `  ${release.name}@${release.newVersion}`).join("\n");
	return `chore(release): releasing ${numPackagesReleased} package(s)

Releases:
${releasesLines}
${skipCI ? "\n[skip ci]\n" : ""}`;
};
const defaultCommitFunctions = {
	getAddMessage,
	getVersionMessage
};
var changeset_commit_default = defaultCommitFunctions;

//#endregion
module.exports = changeset_commit_default;
//# sourceMappingURL=changeset.commit.cjs.map