import {Component, ComponentChild, RenderableProps} from "preact";
import {IADebugFlowSession} from "@oracle/ia-flows-sdk/IAFlowEngineAPI";

export interface DebuggerProps {
    debugSession: IADebugFlowSession
}
export class Debugger extends Component<DebuggerProps> {
    ref = null;
    render(props: RenderableProps<DebuggerProps> | undefined, state: Readonly<unknown> | undefined, context: any): ComponentChild {
        return <div class="debugger" ref={(dom) => this.ref = dom}></div>;
    }

    componentDidMount() {
        const {debugSession} = this.props;
        debugSession.createDebugger(this.ref);
    }

    componentWillUnmount() {
        const {debugSession} = this.props;
        debugSession.destroyDebugger();
    }
}