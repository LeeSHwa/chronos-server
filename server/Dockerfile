# ─────────────────────────────────────────────
# 1) 빌드 단계
#
# gradle 빌드를 컨테이너 안에서 수행한다.
#  - 서버에 JDK/Gradle 을 설치할 필요가 없다.
#  - 빌드가 도는 CPU 아키텍처(amd64 / arm64)에 자동으로 맞춰진다.
#    Oracle Cloud ARM 인스턴스에서 그대로 빌드하면 arm64 이미지가 나온다.
# ─────────────────────────────────────────────
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src

# 의존성은 소스코드보다 훨씬 덜 바뀐다.
# 빌드 스크립트만 먼저 복사해 의존성을 받아두면, 소스만 고쳤을 때
# 이 레이어가 캐시로 재사용되어 재빌드가 훨씬 빨라진다.
COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
RUN chmod +x gradlew && (./gradlew --no-daemon dependencies > /dev/null 2>&1 || true)
# └ 캐시 워밍 목적이라 실패해도 무시한다. 실제 빌드는 아래에서 다시 수행된다.

COPY src src
RUN ./gradlew --no-daemon clean bootJar

# ─────────────────────────────────────────────
# 2) 실행 단계
#
# JRE 만 담는다. 빌드 도구와 소스는 최종 이미지에 포함되지 않아
# 이미지가 가볍고 공격 표면도 줄어든다.
# ─────────────────────────────────────────────
FROM eclipse-temurin:21-jre
WORKDIR /app

COPY --from=build /src/build/libs/*.jar app.jar

# root 로 실행하지 않는다. 컨테이너가 뚫렸을 때 할 수 있는 일을 제한한다.
RUN useradd --system --create-home --shell /usr/sbin/nologin chronos
USER chronos

EXPOSE 8080

# DB 비밀번호는 이미지에 없다. compose 가 SPRING_DATASOURCE_PASSWORD 로 주입한다.
ENTRYPOINT ["java", "-jar", "app.jar"]
