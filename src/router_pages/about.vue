<template>
	<div id="about" class="container">
		<p style="font-size: 1.2em;">
			KxoQA is a ZeroNet alternative to StackExchange - a place where you can ask questions and get answers for any topic. Go to the <a href="./?/top-available" @click.prevent="goto('top-available')">All Available Topics</a> page to see all the topics you can download or create your own topic by cloning one of the default topics.
			<br><br>After posting a question, once you have answers, be sure to mark one as the solution to help others more easily see the correct answer or which one helped you the best. You can do this by clicking the green checkmark. If you want to change which is marked as the solution, click the checkmark for the new solution.
		</p>

		<h5>Recent Updates</h5>
		<div class="divider"></div>

		<p style="font-size: 1.2em;">
			<em>April 11, 2019</em>
			<ul>
				<li>Rebrand from ZeroExchange to KxoQA</li>
				<li>Optimization - no need to reload page when clicking on topic from sidebar.</li>
				<li>About page</li>
				<li>Follow answers and comments to questions from ZeroHello NewsFeed</li>
				<li>Follow comments to answers from ZeroHello NewsFeed</li>
				<li>Now Supports KxoId</li>
			</ul>
		</p>
	</div>
</template>

<script>
	var Router = require("../libs/router.js");

	module.exports = {
		props: ["userInfo"],
		name: "about",
		data: () => {
			return {
				test: "Testing Data!"
			}
		},
		methods: {
			goto: function(to) {
				Router.navigate(to);
			}
		}
	}
</script>