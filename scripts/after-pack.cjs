// electron-builder afterPack hook: stamps the DeltaOS icon and version info into the
// Windows executable using a pure-JS PE resource editor, so no Wine/rcedit is needed
// when cross-building the Windows .exe from Linux or macOS.
const fs = require("fs");
const path = require("path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;
  const ResEdit = await import("resedit");
  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const version = context.packager.appInfo.version;
  const [maj, min, patch] = version.split(".").map((n) => parseInt(n, 10) || 0);

  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);

  // Icon
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, "..", "build", "icon.ico")));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const target = groups[0] ?? { id: 1, lang: 1033 };
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    target.id,
    target.lang,
    ico.icons.map((i) => i.data),
  );

  // Version info
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0] ?? ResEdit.Resource.VersionInfo.createEmpty();
  const lang = { lang: 1033, codepage: 1200 };
  vi.setFileVersion(maj, min, patch, 0, 1033);
  vi.setProductVersion(maj, min, patch, 0, 1033);
  vi.setStringValues(lang, {
    CompanyName: "DeltaOS",
    FileDescription: "DeltaOS",
    ProductName: "DeltaOS",
    InternalName: "DeltaOS",
    OriginalFilename: exeName,
    LegalCopyright: "© 2026 DeltaOS",
    FileVersion: version,
    ProductVersion: version,
  });
  vi.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log(`  • afterPack: stamped icon + version ${version} into ${exeName}`);

  // dxcompiler.dll is only loaded by Chromium's WebGPU (D3D12) backend, which DeltaOS never
  // uses. Dropping it keeps the single-file portable exe comfortably under 100 MB.
  const dxc = path.join(context.appOutDir, "dxcompiler.dll");
  if (fs.existsSync(dxc)) {
    fs.unlinkSync(dxc);
    console.log("  • afterPack: removed unused dxcompiler.dll (WebGPU shader compiler)");
  }
};
