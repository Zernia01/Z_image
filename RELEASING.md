# zernia image 업데이트 배포

자동 업데이트는 GitHub Releases의 `latest.json`과 Tauri 서명을 사용합니다.

## 최초 한 번 설정

GitHub 저장소 `Zernia01/Z_image`의 Actions secrets에 다음 값을 추가합니다.

- `TAURI_SIGNING_PRIVATE_KEY`: `C:\Users\inso0\.tauri\zernia-image.key` 파일의 전체 내용
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: 현재 키는 암호가 없으므로 빈 값

비밀키와 비밀번호는 저장소 파일이나 릴리스에 올리지 않습니다. 비밀키를 잃어버리면 기존 설치본에 새 업데이트를 배포할 수 없으므로 안전하게 백업합니다.

## 새 버전 배포

1. `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`의 버전을 같은 새 SemVer로 변경합니다.
2. 변경 사항을 GitHub에 푸시합니다.
3. 다음 방법 중 하나로 배포를 시작합니다.
   - GitHub의 `Actions` → `Release zernia image` → `Run workflow`를 실행합니다. 앱 버전을 읽어 `v0.2.0` 형태의 태그와 Release를 자동 생성합니다.
   - GitHub에서 새 Release를 게시합니다. `Publish release` 직후 워크플로가 자동 실행되어 그 Release에 빌드 결과를 추가합니다.
   - 같은 버전의 `v` 접두사 태그를 직접 푸시합니다. 예: `v0.2.0`.
4. `.github/workflows/release.yml`이 Windows 설치기, 서명 파일, `latest.json`을 GitHub Release에 게시합니다.

이미 소스 압축파일만 있는 Release를 만들어 둔 경우에는 과거의 `published` 이벤트가 다시 발생하지 않습니다. 이때는 `Actions`에서 `Run workflow`를 한 번 실행해야 합니다.

설치된 앱은 시작할 때 `https://github.com/Zernia01/Z_image/releases/latest/download/latest.json`을 확인합니다.
