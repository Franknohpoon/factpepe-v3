# ⚡ 팩트페페 v3.0 빠른 시작 가이드

**목표**: 이번 주 내 소프트 런칭! 🚀

---

## 📅 타임라인 (3-5일)

```
Day 1-2: 설정 및 테스트
Day 3: 배포
Day 4: 소프트 런칭
Day 5: 피드백 수집
```

---

## 🎯 Day 1-2: 설정 및 테스트

### ✅ Step 1: 프로젝트 다운로드
```
팩트페페 v3.0 폴더를 다운로드 받으세요
→ factpepe-v3.0-complete 폴더
```

### ✅ Step 2: Firebase 설정 (30분)

👉 **FIREBASE_SETUP.md 파일 열기**

간단 요약:
```
1. Firebase Console 접속
   https://console.firebase.google.com

2. 새 프로젝트 만들기
   프로젝트 이름: factpepe

3. Realtime Database 활성화
   위치: asia-southeast1

4. Firebase 설정 정보 복사
   → .env 파일에 붙여넣기

5. 초기 데이터 입력
   팩트 뉴스 2-3개 추가
```

### ✅ Step 3: 로컬 테스트 (10분)
```bash
# 터미널에서
cd factpepe-v3.0-complete
npm install
npm run dev

# 브라우저에서 확인
http://localhost:3000

체크리스트:
□ 팩트 뉴스 탭에 게시물 보임
□ 모든 탭이 정상 작동
□ 모바일에서도 확인
```

---

## 🚀 Day 3: 배포

### ✅ Step 4: GitHub에 업로드 (15분)

👉 **VERCEL_DEPLOY.md 참고**

간단 방법:
```
1. GitHub Desktop 설치
   https://desktop.github.com

2. Repository 생성
   Name: factpepe-v3
   
3. Publish

완료!
```

### ✅ Step 5: Vercel 배포 (20분)

```
1. Vercel 가입
   https://vercel.com/signup
   → GitHub 연동

2. Import Project
   factpepe-v3 선택

3. 환경 변수 설정 (중요!)
   Firebase 정보 7개 입력

4. Deploy 클릭

5. 완료!
   https://factpepe-xxxxx.vercel.app
```

### ✅ Step 6: 도메인 연결 (선택, 30분)
```
1. factpepe.com 구매
   Namecheap, GoDaddy 등

2. Vercel에서 도메인 추가

3. DNS 설정

4. 10-30분 대기

5. factpepe.com 접속!
```

---

## 🎉 Day 4: 소프트 런칭

### ✅ Step 7: 최종 점검

```
□ factpepe.com (또는 Vercel URL) 정상 작동
□ 모든 탭 테스트 완료
□ 모바일 테스트 완료
□ 팩트 뉴스에 게시물 2-3개 준비
□ 버그 없음 확인
```

### ✅ Step 8: X 첫 게시

**버전 1: 초간단 (추천)**
```
📋 오늘의 SSG 라인업

[라인업 내용]

🐸 팩트페페 웹사이트 만들었습니다
→ factpepe.com
(라인업, 응원가, 일정 등)

아직 베타 버전이라 피드백 환영해요

#SSG랜더스
```

**버전 2: 기능 소개**
```
🐸 팩트페페 웹사이트 오픈!

기능:
✅ 승요체크 - 경기 일정/결과
✅ 응원가 - 선수별 가사
✅ 라인업 - 선발 라인업
✅ 팩트 뉴스 - 팩폭 콘텐츠

→ factpepe.com

베타라 피드백 주세요 🙏

#SSG #팩트페페
```

---

## 📊 Day 5: 피드백 수집

### ✅ Step 9: 모니터링
```
□ 방문자 수 확인 (Vercel Analytics)
□ 피드백 수집 (X 댓글)
□ 버그 발견 시 수정
□ Firebase 데이터 업데이트
```

### ✅ Step 10: 지속적 운영
```
매일:
- 라인업 업데이트
- 경기 리뷰 게시물 추가

매주:
- 팩트 뉴스 2-3개 추가
- 응원가 업데이트

수시:
- 버그 수정
- 사용자 피드백 반영
```

---

## 🆘 문제 발생 시

### Firebase 문제
```
→ FIREBASE_SETUP.md 문제 해결 섹션
→ Firebase Console에서 데이터 확인
```

### 배포 문제
```
→ VERCEL_DEPLOY.md 문제 해결 섹션
→ Vercel 빌드 로그 확인
```

### 급한 질문
```
→ README.md 참고
→ 관련 문서 확인
→ 구글 검색
```

---

## 📁 파일 구조 요약

```
factpepe-v3.0-complete/
├── README.md              ← 전체 가이드
├── FIREBASE_SETUP.md      ← Firebase 설정
├── VERCEL_DEPLOY.md       ← Vercel 배포
├── QUICKSTART.md          ← 이 파일
├── package.json
├── .env.example           ← 복사해서 .env 만들기
└── src/
    └── App.jsx            ← 메인 코드
```

---

## ✅ 최종 체크리스트

### 설정
```
□ Firebase 프로젝트 생성
□ .env 파일 설정
□ 로컬 테스트 완료
```

### 배포
```
□ GitHub Repository 생성
□ Vercel 배포 완료
□ 환경 변수 설정
□ 도메인 연결 (선택)
```

### 런칭
```
□ 팩트 뉴스 게시물 2-3개 준비
□ 최종 테스트 완료
□ X 첫 게시 준비
```

---

## 💪 화이팅!

```
Day 1-2: Firebase + 로컬 테스트
Day 3: Vercel 배포
Day 4: 소프트 런칭
Day 5: 피드백 수집

→ 이번 주 내 완료 가능!
```

---

## 📞 도움말

각 단계별 상세 가이드:
- Firebase: FIREBASE_SETUP.md
- Vercel: VERCEL_DEPLOY.md
- 전체: README.md

---

**준비됐나요? 시작합시다! 🚀**
