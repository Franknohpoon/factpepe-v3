import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  // 토스 콘솔에 등록한 앱 식별자 (고유 키)
  // 딥링크: intoss://factpepe-incheon
  appName: 'factpepe-incheon',

  brand: {
    displayName: '팩트페페:인천 야구',
    primaryColor: '#CE1141', // SSG Red
    icon: 'https://factpepe-v3.vercel.app/toss-logo-red.png',
  },

  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'npm run dev:toss',
      build: 'npm run build:toss',
    },
  },

  // 비게임 표준 WebView 프레임 (앱인토스 공통 내비게이션 바)
  webViewProps: {
    type: 'partner',
  },

  // 표준 내비게이션 바: 뒤로가기 + 홈 버튼 + 더보기(자동 제공)
  navigationBar: {
    withBackButton: true,
    withHomeButton: true,
  },

  permissions: [],

  // 빌드 결과물 폴더
  outdir: 'dist-toss',
});
