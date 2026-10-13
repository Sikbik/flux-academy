// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { playerMayHandle } from './hotkeys';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

describe('playerMayHandle', () => {
  it('takes keys pressed on the page itself', () => {
    mount('<main><p id="p">text</p></main>');
    expect(playerMayHandle('ArrowRight', document.body)).toBe(true);
    expect(playerMayHandle('Enter', document.getElementById('p'))).toBe(true);
    expect(playerMayHandle('ArrowLeft', null)).toBe(true);
  });

  it('leaves arrows to inputs, radios, sliders and the step rail', () => {
    mount(
      '<input id="i"><div role="slider" id="s"></div><input type="radio" id="r"><ol><li><button data-seg id="seg">1</button></li></ol>',
    );
    for (const id of ['i', 's', 'r', 'seg']) {
      expect(playerMayHandle('ArrowRight', document.getElementById(id))).toBe(false);
    }
  });

  it('leaves everything inside the stage to the stage', () => {
    mount('<section data-lesson-stage=""><div id="c" tabindex="0"></div></section>');
    expect(playerMayHandle('ArrowRight', document.getElementById('c'))).toBe(false);
    expect(playerMayHandle('Enter', document.getElementById('c'))).toBe(false);
  });

  it('lets arrows through a focused button but not Enter', () => {
    mount('<button id="b">Hint</button><a href="/x" id="a">link</a>');
    expect(playerMayHandle('ArrowRight', document.getElementById('b'))).toBe(true);
    expect(playerMayHandle('Enter', document.getElementById('b'))).toBe(false);
    expect(playerMayHandle('Enter', document.getElementById('a'))).toBe(false);
  });

  it('stays out of the way while a modal has locked the page', () => {
    mount('<p id="p">x</p>');
    document.documentElement.dataset.scrollLocked = 'true';
    expect(playerMayHandle('ArrowRight', document.body)).toBe(false);
    delete document.documentElement.dataset.scrollLocked;
  });
});
