# 🐾 사료 가격 비교 계산기

원본 구매 데이터(구글 스프레드시트)는 비공개로 유지하고, Google Apps Script를 데이터 프록시로 사용해
필요한 계산 결과만 JSON으로 노출하는 구조입니다. 프론트엔드는 정적 HTML/JS로 만들어 GitHub Pages에 올립니다.

## 구조

- `index.html` — 프론트엔드 계산기 (GitHub Pages로 배포)
- `apps-script/Code.gs` — Apps Script 백엔드 코드 (직접 스프레드시트에 붙여넣고 배포)

## 1. Apps Script 배포

1. 원본 스프레드시트를 연다.
2. 상단 메뉴 **확장 프로그램 → Apps Script** 클릭.
3. 기본으로 열리는 `Code.gs` 내용을 전부 지우고, 이 저장소의 `apps-script/Code.gs` 내용을 붙여넣는다.
4. 저장 (Ctrl+S).
5. 우측 상단 **배포 → 새 배포** 클릭.
6. 유형 선택에서 **웹 앱** 선택.
7. 설정:
   - 실행 계정: **나**
   - 액세스 권한이 있는 사용자: **링크를 아는 모든 사용자**
8. **배포** 클릭 → 액세스 승인(본인 계정) → 생성된 **웹 앱 URL**을 복사해둔다.

> 이 URL은 계산 결과 API 주소일 뿐, 원본 시트 자체를 공개하는 것이 아닙니다.

## 2. 프론트엔드에 URL 연결

`index.html` 안에서 아래 줄을 찾아 방금 복사한 웹 앱 URL로 교체한다.

```js
const APPS_SCRIPT_URL = 'PASTE_YOUR_WEB_APP_URL_HERE';
```

## 3. GitHub Pages 활성화

1. 이 저장소의 **Settings → Pages** 로 이동.
2. **Source**를 `Deploy from a branch`로 설정.
3. Branch를 배포하려는 브랜치(예: `main`), 폴더는 `/ (root)`로 선택 후 저장.
4. 몇 분 후 `https://<username>.github.io/<repo>/` 주소로 접속 가능.

## 4. 노션 임베드

완성된 GitHub Pages URL을 노션 페이지에 `/embed` 블록으로 붙여넣으면 된다.

## 데이터 스키마 (3번째 탭 기준)

| 컬럼 | 설명 |
|---|---|
| A 대분류 | 카테고리 (건식/습식 등) |
| B 구매일 | YY.MM.DD, 선택 |
| C 소분류 | 제품명 |
| D 무게(kg/개) | 건식=kg, 습식=g |
| E 가격 | 원 |
| F kg/g당 | 단위당 가격 (자동 기록) |
| G 원산지(제조)/비고 | 선택 |

계산기에서 새 기록을 저장하면 해당 대분류 블록의 마지막 행 바로 아래에 삽입됩니다.
