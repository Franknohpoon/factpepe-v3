# 🐸 팩트페페 v3.0

SSG 랜더스 팩트폭격 팬 서비스

---

## 📋 프로젝트 구조

```
factpepe-v3.0-complete/
├── src/
│   ├── App.jsx           # 메인 앱 (5개 탭 통합)
│   ├── main.jsx          # React 엔트리 포인트
│   └── index.css         # 글로벌 스타일
├── index.html            # HTML 템플릿
├── package.json          # 의존성 정의
├── vite.config.js        # Vite 설정
├── tailwind.config.js    # Tailwind CSS 설정
├── postcss.config.js     # PostCSS 설정
├── .env.example          # 환경 변수 예시
├── FIREBASE_SETUP.md     # Firebase 설정 가이드
├── VERCEL_DEPLOY.md      # Vercel 배포 가이드
└── README.md             # 이 파일
```

---

## 🎯 주요 기능

### 1. 팩트 뉴스 🐸
- X 게시물 아카이브
- 카테고리별 필터 (경기리뷰/선수분석/팀분석/밈)
- 트윗 링크 연결

### 2. 승요체크 📅
- 경기 일정 확인
- 경기 결과 표시

### 3. 응원가 🎵
- 선수별 응원가 가사
- 검색 기능

### 4. 4컷 🎨
- 4컷 만화 생성 (준비 중)

### 5. 라인업 📋
- 오늘의 선발 라인업
- 선수 포지션 표시

---

## 🚀 빠른 시작

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
```bash
# .env.example을 복사해서 .env 생성
cp .env.example .env

# .env 파일을 열어서 Firebase 정보 입력
# 자세한 내용은 FIREBASE_SETUP.md 참고
```

### 3. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 http://localhost:3000 열기

---

## 📚 설정 가이드

### Firebase 설정
👉 [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) 참고

- Firebase 프로젝트 생성
- Realtime Database 설정
- 환경 변수 설정
- 초기 데이터 입력
- 보안 규칙 설정

### Vercel 배포
👉 [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md) 참고

- Vercel 계정 생성
- GitHub 연동
- 프로젝트 배포
- 환경 변수 설정
- 도메인 연결

---

## 🛠️ 기술 스택

### Frontend
- **React 18**: UI 라이브러리
- **Vite**: 빌드 도구
- **Tailwind CSS**: 스타일링

### Backend
- **Firebase Realtime Database**: 데이터 저장소
- **Firebase Hosting**: (선택) 호스팅

### Deployment
- **Vercel**: 배포 플랫폼
- **GitHub**: 버전 관리

---

## 📱 브라우저 지원

- ✅ Chrome (최신)
- ✅ Safari (최신)
- ✅ Firefox (최신)
- ✅ Edge (최신)
- ✅ 모바일 브라우저

---

## 🎨 디자인 시스템

### 색상
```css
SSG Red:   #CE0E2D
SSG Green: #00864F
SSG White: #FFFFFF
```

### 폰트
- Noto Sans KR (한글)

---

## 📂 Firebase 데이터 구조

```json
{
  "factNews": {
    "post_id": {
      "id": "post_id",
      "title": "제목",
      "summary": "요약",
      "imageUrl": "이미지 URL",
      "tweetUrl": "트윗 URL",
      "category": "경기리뷰|선수분석|팀분석|밈",
      "date": "YYYY-MM-DD",
      "timestamp": 1234567890
    }
  },
  "schedule": { ... },
  "chants": { ... },
  "lineup": { ... }
}
```

자세한 내용은 FIREBASE_SETUP.md 참고

---

## 🔧 개발 명령어

### 개발
```bash
npm run dev          # 개발 서버 실행
```

### 빌드
```bash
npm run build        # 프로덕션 빌드
npm run preview      # 빌드 결과 미리보기
```

### 배포
```bash
git add .
git commit -m "메시지"
git push             # Vercel 자동 배포
```

---

## 🐛 문제 해결

### Firebase 연결 오류
```
→ .env 파일 확인
→ Firebase Console에서 API 키 확인
→ 서버 재시작
```

### 빌드 오류
```
→ node_modules 삭제 후 재설치
→ package.json 확인
```

### 배포 오류
```
→ Vercel 환경 변수 확인
→ 빌드 로그 확인
```

---

## 📅 로드맵

### v3.0 (현재)
- ✅ 팩트 뉴스 탭
- ✅ 승요체크 탭
- ✅ 응원가 탭
- ⏳ 4컷 만화
- ✅ 라인업 탭

### v3.1 (예정)
- [ ] 관리자 페이지
- [ ] 이미지 자동 업로드
- [ ] 알림 기능
- [ ] 통계 대시보드

### v3.2 (예정)
- [ ] 유저 로그인
- [ ] 댓글 기능
- [ ] 좋아요 기능

---

## 📞 지원

### 문서
- [Firebase 문서](https://firebase.google.com/docs)
- [Vercel 문서](https://vercel.com/docs)
- [React 문서](https://react.dev)

### 커뮤니티
- GitHub Issues
- Discord
- X: @factpepe

---

## 📄 라이선스

MIT License

---

## 👥 기여자

- Frank (팩트페페 운영자)

---

## 🎉 감사합니다!

팩트페페를 이용해주셔서 감사합니다! 🐸

버그 제보 및 기능 제안은 언제나 환영합니다.

---

**만든 사람**: 팩트페페  
**X**: @factpepe  
**웹사이트**: factpepe.com (준비 중)
