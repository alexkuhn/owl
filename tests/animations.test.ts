import { Component, Env } from "../src/component/component";
import { QWeb } from "../src/qweb/index";
import { useState, useRef } from "../src/hooks";
import {
  makeDeferred,
  makeTestFixture,
  makeTestEnv,
  patchNextFrame,
  renderToDOM,
  unpatchNextFrame
} from "./helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

// We create before each test:
// - fixture: a div, appended to the DOM, intended to be the target of dom
//   manipulations.  Note that it is removed after each test.
// - qweb: a new QWeb instance
// - env: a WEnv, necessary to create new components
// - cssEl: a stylesheet injected into the dom

let fixture: HTMLElement;
let qweb: QWeb;
let env: Env;
let cssEl: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
  env = makeTestEnv();
  qweb = new QWeb();
});

afterEach(() => {
  fixture.remove();
});

class Widget extends Component<any, any> {}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("animations", () => {
  beforeEach(() => {
    cssEl = document.createElement("style");
    let css = `
      .chimay-enter-active, .chimay-leave-active {
        transition-property: opacity;
        transition-duration: 0.1s;
      }
      .chimay-enter, .chimay-leave-to {
        opacity: 0;
      }
    `;
    cssEl.textContent = css.trim();
    document.head.appendChild(cssEl);
  });

  afterEach(() => {
    document.head.removeChild(cssEl);
    unpatchNextFrame();
  });

  test("t-transition, on a simple node (insert)", async () => {
    expect.assertions(5);
    qweb.addTemplate("test", `<span t-transition="chimay">blue</span>`);

    let def = makeDeferred();
    patchNextFrame(cb => {
      expect(node.className).toBe("chimay-enter chimay-enter-active");
      cb();
      expect(node.className).toBe("chimay-enter-active chimay-enter-to");
      def.resolve();
    });
    let node: HTMLElement = <HTMLElement>renderToDOM(qweb, "test");

    expect(node.className).toBe("chimay-enter chimay-enter-active");
    await def; // wait for the mocked repaint to be done
    node.dispatchEvent(new Event("transitionend")); // mock end of css transition
    expect(node.className).toBe("");
  });

  test("t-transition with no delay/duration", async () => {
    expect.assertions(4);
    qweb.addTemplate("test", `<span t-transition="jupiler">blue</span>`);

    let def = makeDeferred();
    patchNextFrame(cb => {
      expect(node.className).toBe("jupiler-enter jupiler-enter-active");
      cb();
      expect(node.className).toBe("");
      def.resolve();
    });
    let node: HTMLElement = <HTMLElement>renderToDOM(qweb, "test");
    expect(node.className).toBe("jupiler-enter jupiler-enter-active");
    await def;
  });

  test("t-transition on a conditional node", async () => {
    expect.assertions(7);

    env.qweb.addTemplate(
      "TestWidget",
      `<div><span t-if="!state.hide" t-transition="chimay">blue</span></div>`
    );
    class TestWidget extends Widget {
      state = useState({ hide: false });
    }
    const widget = new TestWidget(env);

    // insert widget into the DOM
    let def = makeDeferred();
    var spanNode;
    patchNextFrame(cb => {
      expect(spanNode.className).toBe("chimay-enter chimay-enter-active");
      cb();
      expect(spanNode.className).toBe("chimay-enter-active chimay-enter-to");
      def.resolve();
    });
    await widget.mount(fixture);
    spanNode = widget.el!.children[0];
    expect(spanNode.className).toBe("chimay-enter chimay-enter-active");
    await def; // wait for the mocked repaint to be done
    spanNode.dispatchEvent(new Event("transitionend")); // mock end of css transition
    expect(spanNode.className).toBe("");

    // remove span from the DOM
    def = makeDeferred();
    widget.state.hide = true;
    patchNextFrame(cb => {
      expect(spanNode.className).toBe("chimay-leave chimay-leave-active");
      cb();
      expect(spanNode.className).toBe("chimay-leave-active chimay-leave-to");
      def.resolve();
    });
    await def; // wait for the mocked repaint to be done
    spanNode.dispatchEvent(new Event("transitionend")); // mock end of css transition
    expect(spanNode.className).toBe("");
  });

  test("t-transition combined with t-ref", async () => {
    expect.assertions(5);

    env.qweb.addTemplate(
      "TestWidget",
      `<div><span t-ref="span" t-transition="chimay">blue</span></div>`
    );
    class TestWidget extends Widget {
      state = useState({ hide: false });
      span = useRef("span");
    }
    const widget = new TestWidget(env);

    // insert widget into the DOM
    let def = makeDeferred();
    var spanNode;
    patchNextFrame(cb => {
      expect(spanNode.className).toBe("chimay-enter chimay-enter-active");
      cb();
      expect(spanNode.className).toBe("chimay-enter-active chimay-enter-to");
      def.resolve();
    });
    await widget.mount(fixture);
    spanNode = widget.el!.children[0];
    expect(widget.span.el).toBe(spanNode);
    expect(spanNode.className).toBe("chimay-enter chimay-enter-active");
    await def; // wait for the mocked repaint to be done
    spanNode.dispatchEvent(new Event("transitionend")); // mock end of css transition
    expect(spanNode.className).toBe("");
  });

  test("t-transition combined with component", async () => {
    expect.assertions(5);

    env.qweb.addTemplate("Parent", `<div><Child t-transition="chimay"/></div>`);
    env.qweb.addTemplate("Child", `<span>blue</span>`);
    class Child extends Widget {}
    class Parent extends Widget {
      static components = { Child: Child };
    }
    const widget = new Parent(env);

    let def = makeDeferred();
    var spanNode;
    patchNextFrame(cb => {
      expect(fixture.innerHTML).toBe(
        '<div><span class="chimay-enter chimay-enter-active">blue</span></div>'
      );
      cb();
      expect(fixture.innerHTML).toBe(
        '<div><span class="chimay-enter-active chimay-enter-to">blue</span></div>'
      );
      def.resolve();
    });
    await widget.mount(fixture);
    spanNode = widget.el!.children[0];

    expect(env.qweb.templates.Parent.fn.toString()).toMatchSnapshot();
    expect(fixture.innerHTML).toBe(
      '<div><span class="chimay-enter chimay-enter-active">blue</span></div>'
    );

    await def; // wait for the mocked repaint to be done
    spanNode.dispatchEvent(new Event("transitionend")); // mock end of css transition
    expect(fixture.innerHTML).toBe('<div><span class="">blue</span></div>');
  });

  test("t-transition combined with t-component and t-if", async () => {
    expect.assertions(8);

    env.qweb.addTemplate(
      "Parent",
      `<div><t t-if="state.display" t-component="Child" t-transition="chimay"/></div>`
    );
    env.qweb.addTemplate("Child", `<span>blue</span>`);
    class Child extends Widget {}
    class Parent extends Widget {
      static components = { Child: Child };
      state = useState({ display: true });
    }
    const widget = new Parent(env);

    let def = makeDeferred();
    var spanNode;
    patchNextFrame(cb => {
      expect(fixture.innerHTML).toBe(
        '<div><span class="chimay-enter chimay-enter-active">blue</span></div>'
      );
      cb();
      expect(fixture.innerHTML).toBe(
        '<div><span class="chimay-enter-active chimay-enter-to">blue</span></div>'
      );
      def.resolve();
    });
    await widget.mount(fixture);
    spanNode = widget.el!.children[0];

    expect(env.qweb.templates.Parent.fn.toString()).toMatchSnapshot();
    expect(fixture.innerHTML).toBe(
      '<div><span class="chimay-enter chimay-enter-active">blue</span></div>'
    );

    await def; // wait for the mocked repaint to be done
    spanNode.dispatchEvent(new Event("transitionend")); // mock end of css transition
    expect(fixture.innerHTML).toBe('<div><span class="">blue</span></div>');

    // remove span from the DOM
    def = makeDeferred();
    widget.state.display = false;
    patchNextFrame(cb => {
      expect(fixture.innerHTML).toBe(
        '<div><span class="chimay-leave chimay-leave-active" data-owl-key="__5__">blue</span></div>'
      );
      cb();
      expect(fixture.innerHTML).toBe(
        '<div><span class="chimay-leave-active chimay-leave-to" data-owl-key="__5__">blue</span></div>'
      );
      def.resolve();
    });
    await def; // wait for the mocked repaint to be done
    spanNode.dispatchEvent(new Event("transitionend")); // mock end of css transition
    expect(fixture.innerHTML).toBe("<div></div>");
  });

  test("t-transition, remove and re-add before transitionend", async () => {
    expect.assertions(11);

    env.qweb.addTemplates(
      `<templates>
        <div t-name="Parent">
          <button t-on-click="toggle">Toggle</button>
          <span t-if="state.flag" t-transition="chimay">blue</span>
        </div>
      </templates>`
    );
    class Parent extends Widget {
      state = useState({ flag: false });

      toggle() {
        this.state.flag = !this.state.flag;
      }
    }

    const widget = new Parent(env);
    await widget.mount(fixture);
    let button = widget.el!.querySelector("button");

    let def = makeDeferred();
    let phase = "enter";
    patchNextFrame(cb => {
      let spans = fixture.querySelectorAll("span");
      expect(spans.length).toBe(1);
      expect(spans[0].className).toBe(`chimay-${phase} chimay-${phase}-active`);
      cb();
      expect(spans[0].className).toBe(`chimay-${phase}-active chimay-${phase}-to`);
      def.resolve();
    });

    // click display the span
    button!.click();
    await def; // wait for the mocked repaint to be done
    widget.el!.querySelector("span")!.dispatchEvent(new Event("transitionend")); // mock end of css transition
    expect(fixture.innerHTML).toBe('<div><button>Toggle</button><span class="">blue</span></div>');

    // click to remove the span, and click again to re-add it before transitionend
    def = makeDeferred();
    phase = "leave";
    button!.click();

    await def; // wait for the mocked repaint to be done
    def = makeDeferred();
    phase = "enter";
    button!.click();

    await def; // wait for the mocked repaint to be done
    widget.el!.querySelector("span")!.dispatchEvent(new Event("transitionend")); // mock end of css transition
    expect(fixture.innerHTML).toBe('<div><button>Toggle</button><span class="">blue</span></div>');
  });

  test("t-transition combined with t-component, remove and re-add before transitionend", async () => {
    expect.assertions(11);

    env.qweb.addTemplates(
      `<templates>
        <div t-name="Parent">
          <button t-on-click="toggle">Toggle</button>
          <t t-if="state.flag" t-component="Child" t-transition="chimay"/>
        </div>
        <span t-name="Child">blue</span>
      </templates>`
    );
    class Child extends Widget {}
    class Parent extends Widget {
      static components = { Child };
      state = useState({ flag: false });

      toggle() {
        this.state.flag = !this.state.flag;
      }
    }

    const widget = new Parent(env);
    await widget.mount(fixture);
    let button = widget.el!.querySelector("button");

    let def = makeDeferred();
    let phase = "enter";
    patchNextFrame(cb => {
      let spans = fixture.querySelectorAll("span");
      expect(spans.length).toBe(1);
      expect(spans[0].className).toBe(`chimay-${phase} chimay-${phase}-active`);
      cb();
      expect(spans[0].className).toBe(`chimay-${phase}-active chimay-${phase}-to`);
      def.resolve();
    });

    // click display the span
    button!.click();
    await def; // wait for the mocked repaint to be done
    widget.el!.querySelector("span")!.dispatchEvent(new Event("transitionend")); // mock end of css transition
    expect(fixture.innerHTML).toBe('<div><button>Toggle</button><span class="">blue</span></div>');

    // click to remove the span, and click again to re-add it before transitionend
    def = makeDeferred();
    phase = "leave";
    button!.click();

    await def; // wait for the mocked repaint to be done
    def = makeDeferred();
    phase = "enter";
    button!.click();

    await def; // wait for the mocked repaint to be done
    widget.el!.querySelector("span")!.dispatchEvent(new Event("transitionend")); // mock end of css transition
    expect(fixture.innerHTML).toBe('<div><button>Toggle</button><span class="">blue</span></div>');
  });
});
