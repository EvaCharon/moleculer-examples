/* global Vue, axios, moment, _ */

new Vue({
	el: "#app",

	data: {
		posts: [],
		bestPosts: []
	},

	filters: {
		moment: function(val) {
			return moment(val).format("LLL");
		},

		truncate: function(val) {
			return _.truncate(val, { length: 100 });
		}
	},

	methods: {

	},

	mounted: function() {
		var self = this;
		axios.get("/api/posts")
			.then(function(res) {
				self.posts = res;
			});

		axios.get("/api/posts")
			.then(function(res) {
				self.bestPosts = res;
			});
	}
});