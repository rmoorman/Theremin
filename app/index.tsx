import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import "babel-polyfill";
require('normalize.css');

import configureStore from './configureStore';
import App from './Components/App';

//Initialize app with start data
const initialState: any = {};

const store: any = configureStore(initialState || {});

class Main extends React.Component<{}, {}> {

	public render(): React.ReactElement<Provider> {
		return (
			<Provider store={store}>
				<App />
			</Provider>
		);
	}
}

ReactDOM.render(<Main/>, document.getElementById('app'));


