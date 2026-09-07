use crate::model::Result;
use serde::Deserialize;
use std::{
    collections::BTreeMap,
    fs,
    io::Read,
    path::{Path, PathBuf},
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Config {
    pub manifests: Option<Vec<String>>,
    #[serde(default = "default_files")]
    pub max_files: usize,
    #[serde(default = "default_bytes")]
    pub max_bytes: u64,
}
fn default_files() -> usize {
    10_000
}
fn default_bytes() -> u64 {
    256 * 1024 * 1024
}
impl Default for Config {
    fn default() -> Self {
        Self {
            manifests: None,
            max_files: default_files(),
            max_bytes: default_bytes(),
        }
    }
}
pub struct Sources {
    pub root: PathBuf,
    pub config: Config,
    cache: BTreeMap<PathBuf, String>,
    bytes: u64,
    entries: usize,
}
impl Sources {
    pub fn open(root: &Path) -> Result<Self> {
        let root = root
            .canonicalize()
            .map_err(|e| format!("repository: {e}"))?;
        let mut this = Self {
            root,
            config: Config::default(),
            cache: BTreeMap::new(),
            bytes: 0,
            entries: 0,
        };
        let config = this.root.join(".groma-rust.json");
        if config.exists() {
            this.config = serde_json::from_str(&this.read(&config)?)
                .map_err(|e| format!(".groma-rust.json: {e}"))?;
        }
        if this.config.max_files == 0 || this.config.max_bytes == 0 {
            return Err("scan limits must be positive".into());
        }
        Ok(this)
    }
    pub fn checked(&self, file: &Path) -> Result<PathBuf> {
        let path = file
            .canonicalize()
            .map_err(|e| format!("{}: {e}", file.display()))?;
        if !path.starts_with(&self.root) {
            return Err(format!("path outside repository: {}", file.display()));
        }
        Ok(path)
    }
    pub fn relative(&self, file: &Path) -> Result<String> {
        let path = file
            .strip_prefix(&self.root)
            .map_err(|_| "path outside repository")?;
        path.to_str()
            .map(|s| s.replace('\\', "/"))
            .ok_or_else(|| "non-UTF-8 path".into())
    }
    pub fn read(&mut self, file: &Path) -> Result<String> {
        let file = self.checked(file)?;
        if let Some(text) = self.cache.get(&file) {
            return Ok(text.clone());
        }
        if self.cache.len() >= self.config.max_files {
            return Err("maxFiles exceeded; no observation emitted".into());
        }
        let handle = fs::File::open(&file).map_err(|e| e.to_string())?;
        let mut bytes = vec![];
        handle
            .take(2 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())?;
        if bytes.len() > 2 * 1024 * 1024 {
            return Err(format!("source exceeds 2 MiB: {}", self.relative(&file)?));
        }
        self.bytes += bytes.len() as u64;
        if self.bytes > self.config.max_bytes {
            return Err("maxBytes exceeded; no observation emitted".into());
        }
        let text = String::from_utf8(bytes)
            .map_err(|e| format!("{}: {e}", self.relative(&file).unwrap_or_default()))?;
        self.cache.insert(file, text.clone());
        Ok(text)
    }
    pub fn directory(&mut self, root: &Path) -> Result<Vec<PathBuf>> {
        let mut paths = vec![];
        for entry in fs::read_dir(root).map_err(|e| e.to_string())? {
            self.entries += 1;
            if self.entries > 200_000 {
                return Err("directory entry budget exceeded; select manifests explicitly".into());
            }
            let entry = entry.map_err(|e| e.to_string())?;
            if entry.file_type().map_err(|e| e.to_string())?.is_symlink() {
                continue;
            }
            paths.push(entry.path());
        }
        paths.sort();
        Ok(paths)
    }
    pub fn discover(&mut self) -> Result<Vec<PathBuf>> {
        if let Some(manifests) = self.config.manifests.clone() {
            return manifests
                .iter()
                .map(|p| self.checked(&self.root.join(p)))
                .collect();
        }
        let mut pending = vec![self.root.clone()];
        let mut manifests = vec![];
        while let Some(directory) = pending.pop() {
            let manifest = directory.join("Cargo.toml");
            if manifest.is_file() {
                manifests.push(self.checked(&manifest)?);
                continue;
            }
            for path in self.directory(&directory)? {
                if path.is_dir()
                    && !ignored(path.file_name().and_then(|n| n.to_str()).unwrap_or(""))
                {
                    pending.push(path);
                }
            }
        }
        manifests.sort();
        Ok(manifests)
    }
}
fn ignored(name: &str) -> bool {
    matches!(
        name,
        ".git" | ".groma" | "node_modules" | "target" | "vendor" | "dist" | ".cache"
    )
}
