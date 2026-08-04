// Firebase 콘솔 > 프로젝트 설정 > 일반 > "내 앱" SDK 설정에서 값을 복사해 아래에 붙여넣으세요.
// README.md의 "Firebase 프로젝트 만들기" 절차를 먼저 진행한 뒤 이 파일을 채워주세요.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// 값을 채워 넣기 전까지는 사이트가 예시 데이터로만 표시되고,
// 관리자 로그인·글쓰기·메뉴 편집은 비활성 상태로 동작합니다.
export const isFirebaseConfigured =
  !firebaseConfig.apiKey.startsWith("YOUR_");
