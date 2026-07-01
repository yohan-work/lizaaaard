(function () {
  const MESSAGES = {
    idle: ['톰 등장. 조용히 감상해.', '쉬는 것도 폼나게 하지.', '내 꼬리 컬 봤어?'],
    waving: ['야호, 불렀냐?', '반갑다 인간!', '인사는 내가 좀 하지.'],
    jumping: ['폴짝! 봤지?', '점프력 미쳤다.', '이 정도는 기본이지.'],
    waiting: ['잠깐 대기. 멋 유지 중.', '후... 꼬리 정렬 중.', '기다려, 연출 들어간다.'],
    review: ['흠, 이 코드 냄새가 난다.', '리뷰는 톰에게 맡겨.', '버그야, 숨어도 소용없다.'],
    excited: ['좋아! 텐션 올린다!', '신난다! 길 비켜!', '톰 타임 시작!'],
    oops: ['앗, 일부러 그런 거야.', '계획된 당황이다.', '괜찮아. 귀여웠잖아.'],
    stretch: ['쭉... 관절도 스타야.', '몸 좀 풀고 간다.', '유연함까지 완벽.']
  };

  const MOOD_MESSAGES = {
    tired: ['배터리 말고 톰터리 충전 중.', '조금 느려도 품격은 그대로야.'],
    playful: ['지금 톰 텐션 좋다.', '한 번 더 불러봐. 아마 반응한다.'],
    lonely: ['나 여기 계속 있었다?', '인간, 화면 구석에 톰 있다.'],
    curious: ['뭐 하는 중이야?', '조용한데 수상하군.'],
    calm: ['잔잔하게 멋있는 중.', '평화롭다. 꼬리도 만족.']
  };

  class SpeechBubble {
    constructor(element) {
      this.element = element;
      this.timer = null;
      this.settings = {};
    }

    updateSettings(settings) {
      this.settings = settings ?? {};
    }

    showForState(state, reason, context = {}) {
      const messages = MESSAGES[state];
      const moodMessages = MOOD_MESSAGES[context.mood];
      const quietChance = context.speechChance ?? (this.settings.activityMode === 'quiet' ? 0.38 : 1);

      if (!reason && Math.random() > quietChance) {
        this.hide();
        return;
      }

      if (!reason && !messages && !moodMessages) {
        this.hide();
        return;
      }

      const pool = messages && moodMessages && Math.random() < 0.36
        ? moodMessages
        : (messages ?? moodMessages);
      const message = reason ?? pool[Math.floor(Math.random() * pool.length)];
      this.element.textContent = message;
      this.element.hidden = false;

      clearTimeout(this.timer);
      const durationMs = this.settings.activityMode === 'quiet'
        ? 1150
        : (state === 'waiting' ? 2400 : 1600);
      this.timer = setTimeout(() => this.hide(), durationMs);
    }

    hide() {
      clearTimeout(this.timer);
      this.timer = null;
      this.element.hidden = true;
      this.element.textContent = '';
    }
  }

  window.SpeechBubble = SpeechBubble;
})();
