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

  class SpeechBubble {
    constructor(element) {
      this.element = element;
      this.timer = null;
    }

    showForState(state, reason) {
      const messages = MESSAGES[state];
      if (!reason && !messages) {
        this.hide();
        return;
      }

      const message = reason ?? messages[Math.floor(Math.random() * messages.length)];
      this.element.textContent = message;
      this.element.hidden = false;

      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.hide(), state === 'waiting' ? 2200 : 1400);
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
