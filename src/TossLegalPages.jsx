import React from 'react';

/**
 * 토스 미니앱 입점 시 요구되는 법적 페이지 3종.
 * /toss/privacy, /toss/terms, /toss/about
 *
 * 토스 입점 신청 시 위 URL을 그대로 제출.
 *
 * ⚠️ 운영자 정보 (사업자명·연락처·이메일)를 본인 정보로 교체 필요.
 *    아래 OPERATOR 객체만 수정하면 3개 페이지에 모두 반영됨.
 */

// ───────── 운영자 정보 (입점 전 반드시 수정) ─────────
const OPERATOR = {
  serviceName: '팩트페페 (FactPepe)',
  operatorName: 'Frank',
  contactEmail: 'frank.noh8012@gmail.com',
  snsX: 'https://x.com/factpepe_',
  // 사업자 정보 (입점 심사 시 토스가 요구하면 그때 추가)
  effectiveDate: '2026.06.04', // 약관 시행일
};

// ───────── 공통 레이아웃 ─────────
const PageLayout = ({ title, children }) => (
  <div className="min-h-screen bg-black text-white">
    <header
      className="bg-black/90 backdrop-blur-md sticky top-0 z-40 border-b border-zinc-900"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => {
            if (window.history.length > 1) window.history.back();
            else window.location.href = '/toss';
          }}
          className="text-zinc-400 hover:text-white text-sm font-bold"
        >
          ← 뒤로
        </button>
        <span className="text-white font-black text-sm">{title}</span>
        <span className="w-12" />
      </div>
    </header>
    <main
      className="max-w-md mx-auto px-5 py-6"
      style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
    >
      {children}
    </main>
  </div>
);

const Section = ({ no, title, children }) => (
  <section className="mb-6">
    <h2 className="text-white font-black text-base mb-2">
      {no}. {title}
    </h2>
    <div className="text-zinc-300 text-sm leading-relaxed space-y-2">{children}</div>
  </section>
);

const Li = ({ children }) => (
  <li className="text-zinc-300 text-sm leading-relaxed pl-1">{children}</li>
);

// ───────── 개인정보 처리방침 ─────────
export const TossPrivacyPage = () => (
  <PageLayout title="개인정보 처리방침">
    <p className="text-zinc-500 text-xs mb-6">
      시행일: {OPERATOR.effectiveDate}
      <br />
      서비스명: {OPERATOR.serviceName}
    </p>

    <Section no={1} title="수집하는 개인정보 항목">
      <p>{OPERATOR.serviceName}(이하 "서비스")는 다음과 같은 정보를 수집합니다.</p>
      <ul className="list-disc pl-5 space-y-1">
        <Li>익명 식별자: 디바이스에 임의 생성된 게스트 ID 또는 토스 미니앱에서 발급한 사용자 키</Li>
        <Li>이용 기록: 페이지 방문, 탭 전환, 투표 결과, 응원 톡 메시지</Li>
        <Li>기기 정보: 브라우저 종류, 접속 시간 (서버 로그)</Li>
      </ul>
      <p className="text-zinc-400 text-xs mt-2">
        ※ 이름, 휴대전화번호, 이메일, 주민등록번호 등 직접 식별 가능한 개인정보는 일절 수집하지 않습니다.
      </p>
    </Section>

    <Section no={2} title="개인정보 수집·이용 목적">
      <ul className="list-disc pl-5 space-y-1">
        <Li>서비스 이용 통계 및 품질 개선</Li>
        <Li>중복 투표 방지 및 응원 톡 도배 방지</Li>
        <Li>부적절 사용자 차단 등 서비스 운영</Li>
      </ul>
    </Section>

    <Section no={3} title="개인정보 보유·이용 기간">
      <ul className="list-disc pl-5 space-y-1">
        <Li>익명 식별자: 사용자가 브라우저 데이터를 삭제할 때까지</Li>
        <Li>투표·응원 톡 기록: 등록 후 30일 (이후 자동 삭제)</Li>
        <Li>서버 접속 로그: 3개월</Li>
      </ul>
    </Section>

    <Section no={4} title="개인정보 제3자 제공">
      <p>
        서비스는 사용자의 개인정보를 외부에 제공하지 않습니다. 단, 다음의 경우는 예외로 합니다.
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <Li>법령에 따라 수사기관 요청이 있는 경우</Li>
        <Li>사용자 본인이 사전 동의한 경우</Li>
      </ul>
    </Section>

    <Section no={5} title="개인정보 처리 위탁">
      <p>서비스는 다음 외부 인프라를 사용합니다.</p>
      <ul className="list-disc pl-5 space-y-1">
        <Li>Google Firebase Realtime Database (데이터 저장)</Li>
        <Li>Vercel (호스팅·서버리스 함수)</Li>
        <Li>YouTube (영상 임베드)</Li>
      </ul>
    </Section>

    <Section no={6} title="이용자 권리">
      <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
      <ul className="list-disc pl-5 space-y-1">
        <Li>본인 정보 열람·정정·삭제 요청</Li>
        <Li>응원 톡 메시지 삭제 요청</Li>
        <Li>서비스 이용 중단 요청</Li>
      </ul>
      <p className="mt-2">
        문의: <a href={`mailto:${OPERATOR.contactEmail}`} className="text-red-400 underline">{OPERATOR.contactEmail}</a>
      </p>
    </Section>

    <Section no={7} title="고지의 의무">
      <p>
        본 처리방침이 변경될 경우, 서비스 내 공지를 통해 시행 7일 전부터 알리겠습니다.
      </p>
    </Section>

    <div className="mt-8 pt-6 border-t border-zinc-800 text-zinc-500 text-xs">
      <p>{OPERATOR.serviceName}</p>
      <p>운영자: {OPERATOR.operatorName}</p>
      <p>문의: {OPERATOR.contactEmail}</p>
    </div>
  </PageLayout>
);

// ───────── 서비스 이용약관 ─────────
export const TossTermsPage = () => (
  <PageLayout title="서비스 이용약관">
    <p className="text-zinc-500 text-xs mb-6">시행일: {OPERATOR.effectiveDate}</p>

    <Section no={1} title="목적">
      <p>
        본 약관은 {OPERATOR.serviceName}(이하 "서비스")의 이용 조건과 절차, 이용자와 운영자의 권리·의무를 규정합니다.
      </p>
    </Section>

    <Section no={2} title="서비스의 성격">
      <p>
        본 서비스는 <strong className="text-white">SSG 랜더스 구단의 공식 서비스가 아닌, 비공식 팬 서비스</strong>입니다.
        SSG 랜더스 및 한국야구위원회(KBO)와 어떠한 법적·계약적 관계도 없습니다.
      </p>
      <p>
        모든 콘텐츠는 공개된 정보를 기반으로 운영자가 자체적으로 제작·정리한 것이며, 일부 데이터는 사용자의 자발적 참여(투표·응원 톡)로 구성됩니다.
      </p>
    </Section>

    <Section no={3} title="제공 서비스">
      <ul className="list-disc pl-5 space-y-1">
        <Li>SSG 랜더스 일자별 선발 라인업 정보</Li>
        <Li>운영자 분석에 기반한 경기 승률 정보 및 영상</Li>
        <Li>오늘의 경기 결과 투표 및 실시간 응원 톡</Li>
        <Li>구장 좌석·먹거리 정보 (웹 버전)</Li>
      </ul>
    </Section>

    <Section no={4} title="이용자의 의무">
      <p>이용자는 다음 행위를 해서는 안 됩니다.</p>
      <ul className="list-disc pl-5 space-y-1">
        <Li>욕설·비방·음란·차별적 표현 게시</Li>
        <Li>광고·홍보·스팸·도배</Li>
        <Li>타인의 개인정보 게시</Li>
        <Li>서비스 운영 방해, 자동화 도구 사용</Li>
        <Li>저작권·초상권 침해</Li>
      </ul>
      <p>위반 시 사전 통보 없이 메시지 삭제·계정 차단 등의 조치를 취할 수 있습니다.</p>
    </Section>

    <Section no={5} title="콘텐츠 관리">
      <p>
        운영자는 응원 톡 등 사용자 생성 콘텐츠에 대해 다음 조치를 적용합니다.
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <Li>분당 1회 발송 제한, 50자 길이 제한</Li>
        <Li>욕설·외부 링크 자동 필터링</Li>
        <Li>운영자의 실시간 모니터링 및 부적절 게시물 삭제</Li>
      </ul>
    </Section>

    <Section no={6} title="면책 조항">
      <ul className="list-disc pl-5 space-y-1">
        <Li>승률 정보는 공개된 통계 데이터를 기반으로 한 자동 계산값 또는 운영자의 의견이며, 실제 경기 결과를 보장하지 않습니다.</Li>
        <Li>한 줄 분석 코멘트는 자동화된 시스템으로 생성될 수 있으며, 운영자의 검수 전 게시될 수 있습니다.</Li>
        <Li>라인업 정보는 공개 데이터를 자동 수집한 것으로, 시점에 따라 실제와 다를 수 있습니다.</Li>
        <Li>분석 영상 카드는 외부 사이트(YouTube)로 이동하며, 영상 재생 시 YouTube의 정책에 따라 광고가 표시될 수 있습니다.</Li>
        <Li>분석 영상은 운영자의 YouTube 채널(@factpepe)에서 자동으로 불러올 수 있으며, 콘텐츠 책임은 채널 운영자에게 있습니다.</Li>
        <Li>영상 외부 이동은 사용자의 명시적 선택(탭)에 의해서만 발생합니다.</Li>
        <Li>천재지변, 외부 인프라 장애 등으로 인한 서비스 중단에 대해 운영자는 책임을 지지 않습니다.</Li>
      </ul>
    </Section>

    <Section no={7} title="약관의 변경">
      <p>약관 변경 시 시행 7일 전부터 서비스 내 공지하겠습니다.</p>
    </Section>

    <div className="mt-8 pt-6 border-t border-zinc-800 text-zinc-500 text-xs">
      <p>{OPERATOR.serviceName}</p>
      <p>운영자: {OPERATOR.operatorName}</p>
      <p>문의: {OPERATOR.contactEmail}</p>
    </div>
  </PageLayout>
);

// ───────── 운영자 정보 ─────────
export const TossAboutPage = () => (
  <PageLayout title="서비스 소개">
    <div className="text-center mb-6">
      <div className="text-5xl mb-3">🐸</div>
      <h1 className="text-white font-black text-2xl mb-1">{OPERATOR.serviceName}</h1>
      <p className="text-zinc-500 text-xs">SSG 랜더스 팬을 위한 비공식 데이터 미니앱</p>
    </div>

    <Section no={1} title="서비스 안내">
      <p>
        팩트페페는 SSG 랜더스 팬을 위해 만들어진 비공식 팬 서비스입니다.
        매일의 선발 라인업, 분석 기반 승률, 팬 투표, 실시간 응원 톡을 한 화면에서 확인할 수 있습니다.
      </p>
    </Section>

    <Section no={2} title="운영자">
      <p>운영자: {OPERATOR.operatorName}</p>
      <p>문의: <a href={`mailto:${OPERATOR.contactEmail}`} className="text-red-400 underline">{OPERATOR.contactEmail}</a></p>
      <p>SNS: <a href={OPERATOR.snsX} target="_blank" rel="noopener noreferrer" className="text-red-400 underline">@factpepe_</a></p>
    </Section>

    <Section no={3} title="법적 안내">
      <ul className="list-disc pl-5 space-y-1">
        <Li>본 서비스는 SSG 랜더스 구단의 공식 서비스가 아닙니다.</Li>
        <Li>모든 데이터는 공개된 정보를 기반으로 합니다.</Li>
        <Li>경기 결과를 보장하지 않으며, 도박·사행성 목적으로 제공되지 않습니다.</Li>
      </ul>
    </Section>

    <div className="space-y-2 mt-8">
      <a
        href="/toss/privacy"
        className="block bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-300 text-sm font-bold hover:bg-zinc-800 transition-all"
      >
        📄 개인정보 처리방침
      </a>
      <a
        href="/toss/terms"
        className="block bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-300 text-sm font-bold hover:bg-zinc-800 transition-all"
      >
        📋 서비스 이용약관
      </a>
    </div>

    <p className="text-zinc-700 text-[10px] text-center mt-8">
      © {new Date().getFullYear()} {OPERATOR.serviceName}
    </p>
  </PageLayout>
);
