# 🔥 Firebase 설정 가이드

## 📋 목차
1. Firebase 프로젝트 생성
2. Realtime Database 설정
3. 환경 변수 설정
4. 초기 데이터 입력
5. 보안 규칙 설정

---

## 1️⃣ Firebase 프로젝트 생성

### Step 1: Firebase Console 접속
```
https://console.firebase.google.com/
→ Google 계정으로 로그인
```

### Step 2: 새 프로젝트 만들기
```
1. "프로젝트 추가" 클릭
2. 프로젝트 이름: factpepe (또는 원하는 이름)
3. Google 애널리틱스: 선택 사항 (추천: 사용 안 함)
4. "프로젝트 만들기" 클릭
5. 완료 대기 (30초~1분)
```

### Step 3: 웹 앱 추가
```
1. 프로젝트 개요 페이지
2. "</>" 아이콘 클릭 (웹)
3. 앱 닉네임: factpepe-web
4. Firebase Hosting: 체크 안 함 (Vercel 사용)
5. "앱 등록" 클릭
```

### Step 4: Firebase 설정 정보 복사
```javascript
// 이런 형식의 정보가 나옵니다:
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "factpepe-xxxxx.firebaseapp.com",
  databaseURL: "https://factpepe-xxxxx.firebaseio.com",
  projectId: "factpepe-xxxxx",
  storageBucket: "factpepe-xxxxx.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:xxxxxxxxxxxxx"
};

→ 이 정보를 메모장에 복사해두세요!
```

---

## 2️⃣ Realtime Database 설정

### Step 1: Realtime Database 활성화
```
1. 왼쪽 메뉴에서 "빌드" → "Realtime Database" 클릭
2. "데이터베이스 만들기" 클릭
3. 위치 선택: asia-southeast1 (싱가포르) 추천
4. 보안 규칙: "잠금 모드로 시작" 선택
5. "사용 설정" 클릭
```

### Step 2: Database URL 확인
```
생성되면 이런 URL이 나옵니다:
https://factpepe-xxxxx-default-rtdb.asia-southeast1.firebasedatabase.app/

→ 이것이 REACT_APP_FIREBASE_DATABASE_URL입니다!
```

---

## 3️⃣ 환경 변수 설정

### Step 1: .env 파일 생성
```bash
# 프로젝트 루트에 .env 파일 생성
cd factpepe-v3.0-complete
touch .env
```

### Step 2: .env 파일 내용 작성
```env
# .env 파일에 Firebase 설정 정보 입력
REACT_APP_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
REACT_APP_FIREBASE_AUTH_DOMAIN=factpepe-xxxxx.firebaseapp.com
REACT_APP_FIREBASE_DATABASE_URL=https://factpepe-xxxxx-default-rtdb.asia-southeast1.firebasedatabase.app
REACT_APP_FIREBASE_PROJECT_ID=factpepe-xxxxx
REACT_APP_FIREBASE_STORAGE_BUCKET=factpepe-xxxxx.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789012
REACT_APP_FIREBASE_APP_ID=1:123456789012:web:xxxxxxxxxxxxx
```

### Step 3: .gitignore 확인
```
# .gitignore 파일에 .env가 있는지 확인
.env
.env.local

→ 없으면 추가하세요! (중요: API 키 유출 방지)
```

---

## 4️⃣ 초기 데이터 입력

### 팩트 뉴스 데이터 구조

Firebase Console에서 수동으로 입력하거나, 아래 JSON을 import:

```json
{
  "factNews": {
    "post_20260419_defeat": {
      "id": "post_20260419_defeat",
      "title": "💀 4/19 창원 참패",
      "summary": "SSG 2-9 NC\n투수진 붕괴, 타선 침묵 (36타수 2안타)\nNC에게 스윕당함",
      "imageUrl": "https://your-image-url.com/0419-defeat.png",
      "tweetUrl": "https://x.com/factpepe/status/...",
      "category": "경기리뷰",
      "date": "2026-04-19",
      "timestamp": 1713528000
    },
    "post_20260418_victory": {
      "id": "post_20260418_victory",
      "title": "🔥 4/18 창원 대승",
      "summary": "SSG 11-3 NC\n최정, 최지훈 홈런쇼\n김건우 5⅔이닝 3실점 호투",
      "imageUrl": "https://your-image-url.com/0418-victory.png",
      "tweetUrl": "https://x.com/factpepe/status/...",
      "category": "경기리뷰",
      "date": "2026-04-18",
      "timestamp": 1713441600
    }
  },
  "schedule": {
    "game_20260419": {
      "date": "2026-04-19",
      "opponent": "NC",
      "location": "창원 NC파크",
      "result": "패"
    },
    "game_20260420": {
      "date": "2026-04-20",
      "opponent": "KIA",
      "location": "문학",
      "result": null
    }
  },
  "chants": {
    "choi_jeong": {
      "name": "최정",
      "position": "지명타자",
      "lyrics": "최! 정!\n최! 정!\n우리의 주포 최정\n..."
    },
    "park_seonghan": {
      "name": "박성한",
      "position": "우익수",
      "lyrics": "달려라 달려라\n박성한\n..."
    }
  },
  "lineup": {
    "latest": {
      "date": "2026-04-19",
      "opponent": "NC",
      "players": [
        { "name": "박성한", "position": "우익수" },
        { "name": "홍대의", "position": "유격수" },
        { "name": "최정", "position": "지명타자" },
        { "name": "에레디아", "position": "좌익수" },
        { "name": "최지훈", "position": "포수" },
        { "name": "한유섬", "position": "3루수" },
        { "name": "오태곤", "position": "1루수" },
        { "name": "김재환", "position": "중견수" },
        { "name": "김성욱", "position": "2루수" }
      ]
    }
  }
}
```

### 데이터 입력 방법

#### 방법 1: Firebase Console에서 수동 입력
```
1. Realtime Database 페이지
2. "+" 버튼 클릭
3. 이름: factNews, 값: {}
4. factNews 아래에 게시물 추가
```

#### 방법 2: JSON Import
```
1. Realtime Database 페이지
2. 우측 상단 ⋮ 메뉴
3. "JSON 가져오기" 선택
4. 위의 JSON 복사 & 붙여넣기
5. "가져오기" 클릭
```

---

## 5️⃣ 보안 규칙 설정

### Step 1: 규칙 페이지 이동
```
Realtime Database → "규칙" 탭
```

### Step 2: 규칙 설정
```json
{
  "rules": {
    ".read": true,
    ".write": false,
    "factNews": {
      ".read": true,
      ".write": "auth != null"
    },
    "schedule": {
      ".read": true,
      ".write": "auth != null"
    },
    "chants": {
      ".read": true,
      ".write": "auth != null"
    },
    "lineup": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

### 규칙 설명
```
✅ .read: true → 모든 사람이 읽기 가능
❌ .write: false → 기본적으로 쓰기 불가
✅ .write: "auth != null" → 인증된 사용자만 쓰기 가능
```

### Step 3: 게시
```
"게시" 버튼 클릭
→ 규칙 활성화 완료
```

---

## 6️⃣ 테스트

### 로컬에서 테스트
```bash
# 프로젝트 디렉토리로 이동
cd factpepe-v3.0-complete

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 브라우저에서 확인
http://localhost:3000
```

### 확인 사항
```
✅ 팩트 뉴스 탭에 게시물이 보이는가?
✅ 승요체크 탭에 경기 일정이 보이는가?
✅ 응원가 탭에 선수 목록이 보이는가?
✅ 라인업 탭에 라인업이 보이는가?
```

---

## 🚨 문제 해결

### 오류: "Firebase: Error (auth/invalid-api-key)"
```
→ .env 파일의 API 키 확인
→ REACT_APP_ 접두사 확인
→ 서버 재시작 (npm run dev)
```

### 오류: "Permission denied"
```
→ Firebase 보안 규칙 확인
→ .read: true로 설정했는지 확인
```

### 데이터가 안 보임
```
→ Firebase Console에서 데이터 확인
→ Database URL 확인
→ 브라우저 콘솔에서 에러 메시지 확인
```

---

## 📱 다음 단계

1. ✅ Firebase 설정 완료
2. ⏭️ Vercel 배포 (VERCEL_DEPLOY.md 참고)
3. ⏭️ 도메인 연결
4. ⏭️ 소프트 런칭

---

## 💡 팁

### 데이터 백업
```
1. Firebase Console
2. Realtime Database
3. ⋮ 메뉴 → "JSON 내보내기"
4. 정기적으로 백업!
```

### 비용 걱정
```
Firebase 무료 플랜:
✅ Realtime Database: 1GB 저장소
✅ 10GB/월 다운로드
✅ 100 동시 연결

→ 팩트페페 정도는 무료로 충분!
```

---

완료! 🎉 Firebase 설정 끝!
