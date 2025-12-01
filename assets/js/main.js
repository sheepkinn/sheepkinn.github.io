document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const menuBtn = document.getElementById('menu-btn');

  // 动画时间设置
  const timeStage1 = 100;
  const timeStage2 = 800;
  const timePause = 1000;

  // --- 1. 执行 Intro 动画序列 ---
  setTimeout(() => {
    // Stage 1
    body.classList.add('stage-1');

    setTimeout(() => {
      // Stage 2
      body.classList.add('stage-2');

      setTimeout(() => {
        // Stage 3: Intro 结束
        body.classList.add('stage-3');

        // --- 2. 动画结束，激活交互 ---
        setTimeout(() => {
          initMenuInteraction();
        }, 1500);

      }, 800 + timePause);

    }, 600);
  }, timeStage1);


  // --- 菜单交互逻辑 ---
  function initMenuInteraction() {
    console.log("Interaction Ready.");

    menuBtn.addEventListener('click', () => {
      // 切换状态，CSS 负责所有动画
      body.classList.toggle('menu-open');
    });
  }
});