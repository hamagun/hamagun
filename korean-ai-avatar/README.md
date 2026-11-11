# 한국어 AI 대화 (1단계)

여성/남성 캐릭터를 골라 한국어로 대화하는 웹 앱입니다. Claude API를 사용하고, 답변이 생성되는 대로 실시간으로 화면에 나타납니다.

| 캐릭터 | 설명 |
|---|---|
| 서연 (여성, 26세) | 밝고 다정한 디자이너. 반말로 친구처럼 대화 |
| 준호 (남성, 32세) | 차분하고 진지한 개발자. 부드러운 존댓말 |

## 실행 방법

필요한 것: [Node.js](https://nodejs.org/) 20 이상, [Claude API 키](https://console.anthropic.com/)

```bash
cd korean-ai-avatar
npm install
cp .env.example .env      # .env 파일을 열어 ANTHROPIC_API_KEY 값을 넣으세요
npm start
```

브라우저에서 http://localhost:3000 을 엽니다.

> `.env` 파일은 `.gitignore`에 들어 있어 GitHub에 올라가지 않습니다. API 키를 코드나 다른 파일에 직접 적지 마세요.

## 설정 (.env)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | (필수) | Claude API 키 |
| `PORT` | `3000` | 서버 포트 |
| `CHAT_MODEL` | `claude-opus-5-5` | 사용할 모델 |
| `CHAT_EFFORT` | `low` | 생각의 깊이. `low`가 가장 빠르고 저렴하며 일상 대화에 충분합니다. `medium`/`high`로 올리면 답이 더 신중해지지만 느려집니다 |

## 캐릭터 바꾸기

`personas.js`에서 이름, 나이, 성격, 말투, 첫인사를 수정하거나 항목을 추가하면 됩니다. 아바타 이미지는 `public/avatars/`에 있으며, 지금은 임시 일러스트입니다.

## 구조

```
korean-ai-avatar/
├── server.js        # Express 서버, Claude API 스트리밍 (/api/chat)
├── personas.js      # 캐릭터 설정 (시스템 프롬프트)
└── public/          # 화면 (HTML/CSS/JS, 빌드 과정 없음)
```

- 대화 기록은 브라우저에만 있고 서버에 저장하지 않습니다. 새로고침하면 사라집니다.
- 안전 정책으로 답변이 거절되면 서버가 자동으로 다른 모델로 재시도합니다(server-side fallback).

## 다음 단계

1. ~~한국어 텍스트 채팅 + 페르소나 선택~~ (현재)
2. 음성 입력/출력
3. 2D 아바타 립싱크
4. 웹캠 얼굴 추적으로 시선 따라가기
5. 표정 보고 반응하기
