# Tom Lizard Desktop Pet

macOS 화면 하단/Dock 근처를 돌아다니는 작은 Electron 데스크톱 펫입니다. 투명한 always-on-top 창 안에서 도마뱀 캐릭터가 걷고, 멈추고, 손을 흔들고, 점프하며, 우클릭 메뉴와 메뉴바 트레이로 제어할 수 있습니다.

## 실행 방법

```bash
npm install
npm start
```

## 주요 기능

- Dock 근처를 좌우로 부드럽게 걷습니다.
- 화면 끝에 닿으면 자동으로 방향을 바꿉니다.
- 걷는 중 랜덤하게 멈춰서 `idle`, `waving`, `waiting`, `review` 애니메이션을 재생합니다.
- 클릭, 더블 클릭, 우클릭 메뉴를 지원합니다.
- 메뉴바 트레이에서 클릭 통과 상태를 복구할 수 있습니다.
- 크기, 속도, Dock 겹침, 위치, 일시정지 상태를 저장합니다.

## 클릭 조작법

- 한 번 클릭: 손 흔들기
- 더블 클릭: 점프
- 우클릭: 펫 context menu 열기

`Toggle Click-through`를 켜면 펫이 클릭을 받지 않고 아래 앱으로 클릭이 통과합니다. 이 상태에서는 펫 우클릭도 받을 수 없으므로 메뉴바 트레이에서 다시 끄면 됩니다.

## 우클릭 메뉴

- `Pause / Resume`: 움직임 일시정지 또는 재개
- `Size: Small / Medium / Large`: 펫 크기 변경
- `Toggle Click-through`: 클릭 통과 켜기/끄기
- `Reset Position`: Dock 근처 기본 위치로 이동
- `Quit`: 앱 종료

## 트레이 메뉴

macOS Dock에는 앱 아이콘을 표시하지 않고, 메뉴바 트레이에서 제어합니다.

- `Show / Hide Pet`: 펫 창 표시 또는 숨김
- `Pause / Resume`: 움직임 일시정지 또는 재개
- `Toggle Click-through`: 클릭 통과 켜기/끄기
- `Reset Position`: 위치 초기화
- `Quit`: 앱 종료

## 설정 저장 위치

설정은 Electron의 `app.getPath('userData')` 아래 `settings.json`에 저장됩니다. macOS에서는 보통 다음 위치입니다.

```txt
~/Library/Application Support/tom-lizard-desktop-pet/settings.json
```

저장되는 값은 다음과 같습니다.

- `scale`
- `walkSpeed`
- `dockOverlap`
- `clickThrough`
- `paused`
- `lastPosition`
- `sizePreset`

설정 파일이 없거나 JSON이 깨져 있어도 기본값으로 실행됩니다.

## 문제 발생 시 초기화

앱을 종료한 뒤 아래 파일을 삭제하고 다시 실행하면 기본 설정으로 초기화됩니다.

```bash
rm "$HOME/Library/Application Support/tom-lizard-desktop-pet/settings.json"
```

## 프로젝트 구조

```txt
assets/
  spritesheet.webp
  pet.json
src/
  main.js
  preload.js
  index.html
  renderer.js
  styles.css
  main/
    movementController.js
    settingsStore.js
    trayMenu.js
  renderer/
    petStateMachine.js
    speechBubble.js
    spriteAnimator.js
```

## 향후 개선 가능 기능

- 드래그로 직접 위치 이동
- 여러 모니터의 Dock 위치 감지 개선
- 더 다양한 랜덤 행동과 감정 상태
- 말풍선 메시지 커스터마이징
- 앱 시작 시 자동 실행 옵션
