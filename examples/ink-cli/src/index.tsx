import { render } from "ink";
import { App, createAppServer } from "./app.js";

const { server, agent, label } = await createAppServer();
render(<App server={server} agent={agent} label={label} />);
