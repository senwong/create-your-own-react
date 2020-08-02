import ReactDiy from './ReactDiy';

/** @jsx ReactDiy.createElement */

const rootElement = document.getElementById("root");

export default function App() {
	const [value, setValue] = ReactDiy.useState(0);
  return (
		<div>
			<h1>value: {value}</h1>
			<button onClick={() =>setValue(c => c+1)}>add</button>
	</div>
  );
}

ReactDiy.render(<App />, rootElement);
