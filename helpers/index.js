const { S3 } = require('../constants/index');
const db = require('../models');

function encode(data) {
	let buf = Buffer.from(data);
	return buf.toString('base64');
}

async function getBase64Image(filename) {
	if (filename) {
		const data = await S3.getObject({
			Bucket: 'seconds-profile-pictures',
			Key: filename,
		}).promise();
		console.log(data);
		return encode(data.Body);
	}
	return '';
}

function filterOrders(orders, postcodes){
	const filtered = orders.filter((item => {
		let postcode = item["shipping_address"]["zip"]
		//console.log(postcode, postcode.replace(/\s/g, ""));
		return postcodes.some(prefix => postcode.startsWith(prefix) || postcode.replace(/\s/g, "").startsWith(prefix))
	})).map(item => ({ ...item, status: "NEW" }))
	console.log("Num filtered orders: ", filtered.length);
	return filtered
}

function updateStatuses(shopifyOrders, DBOrders) {
	return shopifyOrders.map(item => {
		let dbOrder = DBOrders.find(order => order.id === item.id)
		return dbOrder === undefined ? item : { ...item, status: dbOrder["status"]}
	})
}

function updateOrders(orders, id, status) {
	let index = orders.findIndex(o => o.id === id);
	let order = orders[index];
	let newOrder = {...order, status}
	orders.splice(index, 1, newOrder);
	return orders
}

function filterAndUpdateProducts(products, id, keys) {
	console.log(Object.keys(keys));
	//filter product by id
	let index = products.findIndex(p => p.id === id);
	let product = products[index];
	if ("status" in keys) {
		product = updateStatus(product, keys["status"]);
	}
	if ("quantity" in keys) {
		product = updateStock(product, keys["quantity"]);
	}
	products.splice(index, 1, product);
	return products;
}

function filterAndRemove(products, id){
	let index = products.findIndex(p => p.id === id);
	products.splice(index, 1);
	return products
}

function updateStatus(product, status) {
	return { ...product, status: status };
}

function updateStock(product, quantity) {
	console.log(quantity);
	product["variants"][0]["inventory_quantity"] = quantity;
	return product;
}

async function handleActiveSubscription(subscription) {
	try {
		console.log(subscription);
		const { id, customer, status, items: { data } } = subscription;
		if (status === 'active') {
			const user = await db.User.findOneAndUpdate(
				{ stripeCustomerId: customer },
				{ subscriptionId: id, subscriptionPlan: data[0].price.lookup_key },
				{ new: true }
			);
			if (user) {
				console.log('------------------------------------');
				console.log('updated user:', user);
				console.log('------------------------------------');
				return 'Subscription is active';
			} else {
				throw new Error('No user found with a matching stripe customer ID!');
			}
		} else {
			throw new Error('Subscription status is not active');
		}
	} catch (err) {
		console.error(err);
		throw err
	}
}

async function handleCanceledSubscription(subscription) {
	try {
		console.log(subscription);
		const { customer, status } = subscription;
		if (status === 'canceled') {
			const user = await db.User.findOneAndUpdate(
				{ stripeCustomerId: customer },
				{ subscriptionId: '', subscriptionPlan: '' },
				{ new: true }
			);
			console.log('------------------------------------');
			console.log('updated user:', user);
			console.log('------------------------------------');
			return 'Subscription is canceled';
		} else {
			throw new Error('Subscription status is not canceled');
		}
	} catch (err) {
		console.error(err);
		throw new Error('No user found with a matching stripe customer ID!');
	}
}

module.exports = {
	getBase64Image,
	filterOrders,
	updateOrders,
	filterAndRemove,
	updateStatuses,
	filterAndUpdateProducts,
	handleActiveSubscription,
	handleCanceledSubscription
}