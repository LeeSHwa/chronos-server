# Chronos Admin — 정적 파일 서빙용 이미지
#
# nginx는 /usr/share/nginx/html 을 기본 루트로 서빙하므로 설정 파일이 필요 없다.
# vendor/ 안의 tailwind.js, chart.umd.min.js 도 함께 복사되므로 인터넷 없이 동작한다.
#
# 빌드:  docker build -t chronos-web .
# 실행:  docker run -d --name chronos-web -p 8081:80 chronos-web
# 접속:  http://localhost:8081
#
# 주의: app.js 의 BASE_URL 이 http://localhost:8080 이므로,
#      이 페이지를 여는 브라우저와 같은 PC에서 Spring 서버가 돌고 있어야 데이터가 나온다.
FROM nginx:alpine

COPY . /usr/share/nginx/html

EXPOSE 80
