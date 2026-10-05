# Chronos Admin — 정적 파일 서빙용 이미지
#
# nginx는 /usr/share/nginx/html 을 기본 루트로 서빙하므로 설정 파일이 필요 없다.
# 페이지가 여러 HTML 파일(index/users/user/stats/status)로 나뉘어 있지만 전부 실제 파일이라
# SPA 폴백(try_files) 설정도 필요 없다.
# vendor/ 안의 tailwind.js, chart.umd.min.js 도 함께 복사되므로 인터넷 없이 동작한다.
#
# 빌드:  docker build -t chronos-web .
# 실행:  docker run -d --name chronos-web -p 8081:80 chronos-web
# 접속:  http://localhost:8081
#
# 주의: assets/api.js 의 BASE_URL 은 이 페이지를 내려준 호스트의 8080 포트를 가리킨다.
#      즉 어드민 화면을 여는 주소와 같은 호스트에서 Spring 서버가 떠 있어야 데이터가 나온다.
FROM nginx:alpine

COPY . /usr/share/nginx/html

EXPOSE 80
