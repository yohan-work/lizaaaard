(function () {
  const MESSAGES = {
    idle: ['잠깐 쉬는 중', '오늘도 좋은 하루!'],
    waving: ['안녕!', '반가워!'],
    jumping: ['점프!'],
    waiting: ['기다리는 중...', '음...'],
    review: ['코드 리뷰 중', '꼼꼼히 볼게!']
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
