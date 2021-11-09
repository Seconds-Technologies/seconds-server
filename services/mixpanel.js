const Mixpanel = require('mixpanel');
const mixpanel = Mixpanel.init(process.env.MIXPANEL_TOKEN, { host: 'api-eu.mixpanel.com' });

let env_check = process.env.MIXPANEL_ENV === 'production' || process.env.MIXPANEL_ENV === 'staging';
console.log(env_check)

let actions = {
	identify: (id) => {
		if (env_check) mixpanel.alias(id, "current");
	},
	track: (name, props) => {
		if (env_check) mixpanel.track(name, props);
	},
};

module.exports = actions;