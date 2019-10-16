import { Component } from "../component/component";
import { xml } from "../tags";

export class AsyncRoot extends Component<any, any> {
  static template = xml`<t t-slot="default"/>`;

  async __updateProps(nextProps, parentFiber) {
    this.render(parentFiber.force);
  }
}
