use directories::ProjectDirs;
use std::{fs, path::PathBuf};
use windows::Win32::UI::Shell::{SHChangeNotify, SHCNE_ASSOCCHANGED, SHCNF_IDLIST};
use winreg::{
    enums::{HKEY_CURRENT_USER, REG_NONE},
    RegKey, RegValue,
};

const FILE_TYPES: &[FileType] = &[
    FileType::new(
        "jpg",
        &["jpg", "jpeg", "jpe", "jfif"],
        include_bytes!("../../../icons/file-types/jpg.ico"),
    ),
    FileType::new(
        "png",
        &["png"],
        include_bytes!("../../../icons/file-types/png.ico"),
    ),
    FileType::new(
        "apng",
        &["apng"],
        include_bytes!("../../../icons/file-types/apng.ico"),
    ),
    FileType::new(
        "avif",
        &["avif"],
        include_bytes!("../../../icons/file-types/avif.ico"),
    ),
    FileType::new(
        "gif",
        &["gif"],
        include_bytes!("../../../icons/file-types/gif.ico"),
    ),
    FileType::new(
        "bmp",
        &["bmp", "dib"],
        include_bytes!("../../../icons/file-types/bmp.ico"),
    ),
    FileType::new(
        "tiff",
        &["tif", "tiff"],
        include_bytes!("../../../icons/file-types/tiff.ico"),
    ),
    FileType::new(
        "ico",
        &["ico"],
        include_bytes!("../../../icons/file-types/ico.ico"),
    ),
];

struct FileType {
    name: &'static str,
    extensions: &'static [&'static str],
    icon: &'static [u8],
}

impl FileType {
    const fn new(
        name: &'static str,
        extensions: &'static [&'static str],
        icon: &'static [u8],
    ) -> Self {
        Self {
            name,
            extensions,
            icon,
        }
    }

    fn prog_id(&self) -> String {
        format!("ZerniaImage.{}", self.name)
    }
}

/// Registers separate ProgIDs so Explorer can show the requested icon for each image format.
/// Protected UserChoice values are deliberately left untouched; Windows remains in control of
/// the user's default-app selection.
pub fn register() -> Result<(), String> {
    let project_dirs = ProjectDirs::from("com", "zernia", "zernia image")
        .ok_or_else(|| "Windows 사용자 데이터 폴더를 찾지 못했습니다.".to_string())?;
    let icon_dir = project_dirs.data_local_dir().join("file-type-icons");
    fs::create_dir_all(&icon_dir).map_err(|error| error.to_string())?;

    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    let open_command = format!("\"{}\" \"%1\"", executable.display());
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let classes = create_key(&hkcu, r"Software\Classes")?;
    let capabilities = create_key(&hkcu, r"Software\ZerniaImage\Capabilities")?;
    capabilities
        .set_value("ApplicationName", &"zernia image")
        .map_err(|error| error.to_string())?;
    capabilities
        .set_value(
            "ApplicationDescription",
            &"Fast, private desktop image viewer",
        )
        .map_err(|error| error.to_string())?;
    let file_associations = create_key(&capabilities, "FileAssociations")?;

    for file_type in FILE_TYPES {
        let icon_path = write_icon(&icon_dir, file_type)?;
        let prog_id = file_type.prog_id();
        let prog_key = create_key(&classes, &prog_id)?;
        prog_key
            .set_value(
                "",
                &format!("zernia image {} file", file_type.name.to_uppercase()),
            )
            .map_err(|error| error.to_string())?;
        create_key(&prog_key, "DefaultIcon")?
            .set_value("", &format!("{},0", icon_path.display()))
            .map_err(|error| error.to_string())?;
        create_key(&prog_key, r"shell\open\command")?
            .set_value("", &open_command)
            .map_err(|error| error.to_string())?;

        for extension in file_type.extensions {
            let dotted_extension = format!(".{extension}");
            file_associations
                .set_value(&dotted_extension, &prog_id)
                .map_err(|error| error.to_string())?;
            let extension_key = create_key(&classes, &dotted_extension)?;
            create_key(&extension_key, "OpenWithProgids")?
                .set_raw_value(
                    &prog_id,
                    &RegValue {
                        bytes: Vec::new(),
                        vtype: REG_NONE,
                    },
                )
                .map_err(|error| error.to_string())?;

            // Tauri's Windows installer uses the bare extension (for example `png`) as
            // the ProgID. Existing UserChoice entries keep pointing at that ProgID after
            // an update, so also replace its generic executable icon when it belongs to us.
            let installed_prog_key = create_key(&classes, extension)?;
            let is_zernia_prog_id = installed_prog_key
                .get_value::<String, _>("")
                .map(|value| value == "ZerniaPhotoViewer.Image")
                .unwrap_or(false);
            if is_zernia_prog_id {
                create_key(&installed_prog_key, "DefaultIcon")?
                    .set_value("", &format!("{},0", icon_path.display()))
                    .map_err(|error| error.to_string())?;
            }
        }
    }

    create_key(&hkcu, r"Software\RegisteredApplications")?
        .set_value("zernia image", &r"Software\ZerniaImage\Capabilities")
        .map_err(|error| error.to_string())?;

    unsafe {
        SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, None, None);
    }
    Ok(())
}

fn create_key(parent: &RegKey, path: &str) -> Result<RegKey, String> {
    parent
        .create_subkey(path)
        .map(|(key, _)| key)
        .map_err(|error| error.to_string())
}

fn write_icon(icon_dir: &std::path::Path, file_type: &FileType) -> Result<PathBuf, String> {
    let path = icon_dir.join(format!("{}.ico", file_type.name));
    let already_current = fs::read(&path)
        .map(|existing| existing == file_type.icon)
        .unwrap_or(false);
    if !already_current {
        fs::write(&path, file_type.icon).map_err(|error| error.to_string())?;
    }
    Ok(path)
}

/// Windows의 보호된 UserChoice 값을 수정하지 않고 공식 기본 앱 설정을 엽니다.
pub fn open_default_apps_settings() -> Result<(), String> {
    std::process::Command::new("explorer.exe")
        .arg("ms-settings:defaultapps")
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}
