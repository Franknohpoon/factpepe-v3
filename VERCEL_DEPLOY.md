# 🚀 Vercel 배포 가이드

## 📋 목차
1. Vercel 계정 생성
2. GitHub 연동
3. 프로젝트 배포
4. 환경 변수 설정
5. 도메인 연결
6. 배포 확인

---

## 1️⃣ Vercel 계정 생성

### Step 1: Vercel 가입
```
https://vercel.com/signup
→ "Continue with GitHub" 클릭 (추천)
→ GitHub 계정으로 로그인
```

### Step 2: 권한 승인
```
→ Vercel이 GitHub에 접근 허용
→ "Authorize Vercel" 클릭
```

---

## 2️⃣ GitHub 연동

### Step 1: GitHub Repository 생성

#### 방법 A: GitHub Desktop 사용 (간편)
```
1. GitHub Desktop 열기
2. File → New Repository
3. Name: factpepe-v3
4. Local Path: 프로젝트 폴더 선택
5. Create Repository
6. Publish Repository
```

#### 방법 B: 터미널 사용
```bash
# 프로젝트 디렉토리로 이동
cd factpepe-v3.0-complete

# Git 초기화
git init

# .gitignore 파일 생성
cat > .gitignore << EOF
# 환경 변수
.env
.env.local
.env.production

# 의존성
node_modules
.pnp
.pnp.js

# 빌드
dist
build
.next

# 디버그
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS
.DS_Store
Thumbs.db
EOF

# 모든 파일 추가
git add .

# 첫 커밋
git commit -m "Initial commit - 팩트페페 v3.0"

# GitHub에서 새 Repository 생성
# https://github.com/new
# Repository name: factpepe-v3
# Public/Private: Public (추천)
# Create repository 클릭

# 원격 저장소 추가 (YOUR_USERNAME을 GitHub 계정명으로 변경)
git remote add origin https://github.com/YOUR_USERNAME/factpepe-v3.git

# 푸시
git branch -M main
git push -u origin main
```

---

## 3️⃣ 프로젝트 배포

### Step 1: Vercel에서 Import
```
1. Vercel 대시보드 (https://vercel.com/dashboard)
2. "Add New..." → "Project" 클릭
3. "Import Git Repository" 섹션
4. GitHub에서 factpepe-v3 찾기
5. "Import" 클릭
```

### Step 2: 프로젝트 설정
```
Configure Project:

Project Name: factpepe
Framework Preset: Vite (자동 감지)
Root Directory: ./
Build Command: npm run build (자동)
Output Directory: dist (자동)
Install Command: npm install (자동)

→ "Deploy" 클릭하지 말고 다음 단계로!
```

---

## 4️⃣ 환경 변수 설정 (중요!)

### Step 1: 환경 변수 추가

배포하기 전에 환경 변수를 설정해야 합니다!

```
Configure Project 페이지에서:

1. "Environment Variables" 섹션 찾기
2. 아래 변수들을 하나씩 추가:

Name: REACT_APP_FIREBASE_API_KEY
Value: AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
(Firebase Console에서 복사)

Name: REACT_APP_FIREBASE_AUTH_DOMAIN
Value: factpepe-xxxxx.firebaseapp.com

Name: REACT_APP_FIREBASE_DATABASE_URL
Value: https://factpepe-xxxxx-default-rtdb.asia-southeast1.firebasedatabase.app

Name: REACT_APP_FIREBASE_PROJECT_ID
Value: factpepe-xxxxx

Name: REACT_APP_FIREBASE_STORAGE_BUCKET
Value: factpepe-xxxxx.appspot.com

Name: REACT_APP_FIREBASE_MESSAGING_SENDER_ID
Value: 123456789012

Name: REACT_APP_FIREBASE_APP_ID
Value: 1:123456789012:web:xxxxxxxxxxxxx
```

### Step 2: 환경 설정
```
각 환경 변수마다:
✅ Production 체크
✅ Preview 체크
✅ Development 체크

→ 모두 체크!
```

---

## 5️⃣ 배포 시작!

### Step 1: Deploy 클릭
```
모든 환경 변수 설정 완료 후:
→ "Deploy" 버튼 클릭!
```

### Step 2: 배포 진행 확인
```
Building...
→ 1-3분 소요

성공하면:
✅ Congratulations!
✅ Your project has been deployed
```

### Step 3: 배포된 URL 확인
```
배포 완료 후:
https://factpepe-xxxxx.vercel.app

→ 이것이 당신의 웹사이트 주소!
→ 클릭해서 확인!
```

---

## 6️⃣ 도메인 연결 (factpepe.com)

### Step 1: 도메인 구매

#### 추천 도메인 등록업체
```
- Namecheap: https://www.namecheap.com
- GoDaddy: https://www.godaddy.com
- Gabia: https://www.gabia.com (한국)

factpepe.com 검색
→ 구매 (연 $10-15)
```

### Step 2: Vercel에서 도메인 추가
```
1. Vercel 프로젝트 대시보드
2. "Settings" 탭
3. "Domains" 섹션
4. "Add" 버튼
5. 도메인 입력: factpepe.com
6. "Add" 클릭
```

### Step 3: DNS 설정

Vercel이 알려주는 DNS 설정:

#### A Record
```
Type: A
Name: @
Value: 76.76.21.21
TTL: Auto
```

#### CNAME Record
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: Auto
```

### Step 4: 도메인 등록업체에서 DNS 설정

#### Namecheap 예시:
```
1. Namecheap 로그인
2. Domain List
3. factpepe.com → Manage
4. Advanced DNS 탭
5. Add New Record:
   - Type: A Record
   - Host: @
   - Value: 76.76.21.21
   
6. Add New Record:
   - Type: CNAME
   - Host: www
   - Value: cname.vercel-dns.com
   
7. Save
```

### Step 5: 전파 대기
```
DNS 전파: 5분~48시간
보통: 10-30분이면 완료

확인:
https://factpepe.com
→ 사이트가 보이면 성공!
```

---

## 7️⃣ 자동 배포 설정

### GitHub에 푸시하면 자동 배포!

```bash
# 코드 수정 후
git add .
git commit -m "업데이트: 새 기능 추가"
git push

→ Vercel이 자동으로 감지
→ 자동으로 새 버전 배포!
→ 1-2분 후 사이트 업데이트
```

---

## 8️⃣ 배포 확인 체크리스트

### ✅ 기본 확인
```
□ 사이트가 로드되는가?
□ 모든 탭이 작동하는가?
□ Firebase 데이터가 보이는가?
□ 모바일에서 잘 보이는가?
```

### ✅ 팩트 뉴스 탭
```
□ 게시물이 보이는가?
□ 필터가 작동하는가?
□ 트윗 링크가 작동하는가?
□ 이미지가 로드되는가?
```

### ✅ 승요체크 탭
```
□ 경기 일정이 보이는가?
□ 날짜가 올바른가?
```

### ✅ 응원가 탭
```
□ 선수 목록이 보이는가?
□ 응원가 가사가 보이는가?
```

### ✅ 라인업 탭
```
□ 라인업이 보이는가?
□ 선수 순서가 맞는가?
```

---

## 🚨 문제 해결

### 문제: 빌드 실패
```
Error: Module not found

해결:
1. package.json 확인
2. npm install 실행
3. 다시 푸시
```

### 문제: 환경 변수 오류
```
Error: Firebase not configured

해결:
1. Vercel → Settings → Environment Variables
2. 모든 REACT_APP_ 변수 확인
3. Redeploy
```

### 문제: 페이지가 안 보임
```
404 Not Found

해결:
1. vercel.json 파일 확인
2. 빌드 로그 확인
3. Vercel 서포트 문의
```

### 문제: 도메인 연결 안 됨
```
DNS 전파 대기 중일 수 있음

확인:
https://dnschecker.org
→ factpepe.com 입력
→ 전파 상태 확인
```

---

## 📊 배포 후 모니터링

### Vercel Analytics (선택)
```
1. Vercel 프로젝트 → Analytics 탭
2. 방문자 수 확인
3. 페이지 성능 확인
```

### Firebase Usage (선택)
```
1. Firebase Console
2. Realtime Database → Usage 탭
3. 데이터 전송량 확인
```

---

## 🎯 다음 단계

### 배포 완료 후:
```
1. ✅ 사이트 테스트
2. ✅ 소프트 런칭 준비
3. ✅ X에 첫 링크 공유
4. ✅ 피드백 수집
```

### 소프트 런칭 체크리스트:
```
□ factpepe.com 정상 작동
□ Firebase 데이터 2-3개 준비
□ X 첫 게시물 문구 준비
□ 버그 테스트 완료
```

---

## 💡 유용한 명령어

### 로컬 개발
```bash
npm run dev        # 개발 서버 실행
npm run build      # 빌드 테스트
npm run preview    # 빌드 결과 미리보기
```

### Git 명령어
```bash
git status         # 변경 사항 확인
git add .          # 모든 변경 사항 추가
git commit -m ""   # 커밋
git push           # 푸시 (자동 배포)
```

### Vercel CLI (선택)
```bash
npm i -g vercel    # Vercel CLI 설치
vercel             # 로컬에서 바로 배포
vercel --prod      # 프로덕션 배포
```

---

## 🎉 완료!

```
✅ Firebase 설정 완료
✅ Vercel 배포 완료
✅ 도메인 연결 완료
✅ 자동 배포 설정 완료

→ factpepe.com 공개 준비 완료!
```

---

## 📞 도움이 필요하면?

### Vercel 문서
```
https://vercel.com/docs
```

### Firebase 문서
```
https://firebase.google.com/docs
```

### 커뮤니티
```
Stack Overflow
GitHub Issues
Discord
```

---

이제 소프트 런칭만 남았습니다! 🚀
