"use strict";

var advancedStats = execMain(function(kpretty, round, kpround) {
	var div = $('<div />').css('text-align', 'center').css('font-size', '0.8em');
	var isEnable = false;

	function getTimeInSeconds(timeData) {
		if (!timeData || !timeData[0] || timeData[0][0] == -1) {
			return null; // DNF
		}
		// timeData[0] = [penalty, phaseN_end_time, ...]
		// Total time = penalty + phase1_end_time
		return (timeData[0][0] + timeData[0][1]) / 1000; // Convert milliseconds to seconds
	}

	function updateAdvancedStats() {
		if (!isEnable) {
			return;
		}
		div.empty();

		var times_stats_table = stats.getTimesStatsTable();
		var timesLen = times_stats_table.timesLen;
		
		if (timesLen == 0) {
			div.html('<p>No solves recorded yet.</p>');
			return;
		}

		// Calculate sub-X counts
		var subCounts = {};
		var subThresholds = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
		for (var i = 0; i < subThresholds.length; i++) {
			subCounts[subThresholds[i]] = [];
		}

		// Calculate per-second counts
		var perSecondCounts = {};
		var perSecondSolves = {};

		// Iterate through all solves
		for (var i = 0; i < timesLen; i++) {
			var timeData = stats.timesAt(i);
			var timeInSeconds = getTimeInSeconds(timeData);
			
			if (timeInSeconds === null) {
				continue; // Skip DNFs
			}

			// Count sub-X
			for (var j = 0; j < subThresholds.length; j++) {
				if (timeInSeconds < subThresholds[j]) {
					subCounts[subThresholds[j]].push({
						index: i,
						time: timeInSeconds,
						scramble: timeData[1] || '',
						comment: timeData[2] || '',
						timestamp: timeData[3] || 0
					});
				}
			}

			// Count per second
			var second = Math.floor(timeInSeconds);
			if (!perSecondCounts[second]) {
				perSecondCounts[second] = 0;
				perSecondSolves[second] = [];
			}
			perSecondCounts[second]++;
			perSecondSolves[second].push({
				index: i,
				time: timeInSeconds,
				scramble: timeData[1] || '',
				comment: timeData[2] || '',
				timestamp: timeData[3] || 0
			});
		}

		// Build HTML
		var html = [];

		// Sub-X section
		html.push('<h3>Sub-X Counts</h3>');
		html.push('<table class="table" style="margin: 10px auto;">');
		html.push('<tr><th>Threshold</th><th>Count</th><th>Percentage</th></tr>');
		for (var i = 0; i < subThresholds.length; i++) {
			var threshold = subThresholds[i];
			var count = subCounts[threshold].length;
			var percentage = timesLen > 0 ? ((count / timesLen) * 100).toFixed(2) : 0;
			html.push('<tr class="click sub-row" data-sub="' + threshold + '" style="cursor: pointer;">');
			html.push('<td>Sub-' + threshold + '</td>');
			html.push('<td>' + count + '</td>');
			html.push('<td>' + percentage + '%</td>');
			html.push('</tr>');
		}
		html.push('</table>');

		// Per-second section
		html.push('<h3>Per-Second Counts</h3>');
		html.push('<table class="table" style="margin: 10px auto;">');
		html.push('<tr><th>Second</th><th>Count</th><th>Percentage</th></tr>');
		var sortedSeconds = Object.keys(perSecondCounts).map(Number).sort(function(a, b) { return a - b; });
		for (var i = 0; i < sortedSeconds.length; i++) {
			var second = sortedSeconds[i];
			var count = perSecondCounts[second];
			var percentage = timesLen > 0 ? ((count / timesLen) * 100).toFixed(2) : 0;
			html.push('<tr class="click second-row" data-second="' + second + '" style="cursor: pointer;">');
			html.push('<td>' + second + 's</td>');
			html.push('<td>' + count + '</td>');
			html.push('<td>' + percentage + '%</td>');
			html.push('</tr>');
		}
		html.push('</table>');

		// WCA Ranking section
		html.push('<h3>WCA World Ranking</h3>');
		html.push('<div id="wcaComparison">');
		html.push('<button class="click" id="loadWCA" style="padding: 5px 10px; margin: 5px;">Load World Ranking</button>');
		html.push('<div id="wcaResults" style="margin-top: 10px;"></div>');
		html.push('</div>');

		div.html(html.join(''));

		// Store data for click handlers - use closure to ensure data is accessible
		var storedSubCounts = subCounts;
		var storedPerSecondSolves = perSecondSolves;
		div.data('subCounts', subCounts);
		div.data('perSecondSolves', perSecondSolves);

		// Bind click handlers directly to the rows after HTML is set
		// Use a closure to capture the data - bind to the entire row
		setTimeout(function() {
			div.find('.sub-row').each(function() {
				var $row = $(this);
				var threshold = parseInt($row.attr('data-sub'), 10);
				var solves = storedSubCounts[threshold] || [];
				$row.off('click.subrow').on('click.subrow', function(e) {
					e.stopPropagation();
					e.preventDefault();
					if (solves && solves.length > 0) {
						showSolvesList(solves, 'Sub-' + threshold + ' Solves');
					} else {
						$.alert('No solves found for Sub-' + threshold + '. (Count: ' + (solves ? solves.length : 0) + ')');
					}
					return false;
				});
			});

			// Click handlers for per-second rows
			div.find('.second-row').each(function() {
				var $row = $(this);
				var second = parseInt($row.attr('data-second'), 10);
				var solves = storedPerSecondSolves[second] || [];
				$row.off('click.secondrow').on('click.secondrow', function(e) {
					e.stopPropagation();
					e.preventDefault();
					if (solves && solves.length > 0) {
						showSolvesList(solves, second + 's Solves');
					} else {
						$.alert('No solves found for ' + second + 's. (Count: ' + (solves ? solves.length : 0) + ')');
					}
					return false;
				});
			});
		}, 0);

		// WCA API handler
		div.find('#loadWCA').off('click').on('click', function() {
			loadWCARanking();
		});
	}

	function showSolvesList(solves, title) {
		// DEBUG: Log function call
		console.log('showSolvesList called with', solves.length, 'solves, title:', title);
		
		if (!solves || solves.length == 0) {
			$.alert('No solves found.');
			return;
		}

		var container = $('<div>').css({
			'max-height': '400px',
			'overflow-y': 'auto',
			'padding': '10px'
		});
		
		var html = [];
		html.push('<h4 style="margin-top: 0;">' + title + ' (' + solves.length + ')</h4>');
		html.push('<table class="table" style="width: 100%; border-collapse: collapse;">');
		html.push('<tr><th style="padding: 5px; border: 1px solid #ccc;">#</th><th style="padding: 5px; border: 1px solid #ccc;">Time</th><th style="padding: 5px; border: 1px solid #ccc;">Scramble</th><th style="padding: 5px; border: 1px solid #ccc;">Comment</th></tr>');
		
		for (var i = 0; i < solves.length; i++) {
			var solve = solves[i];
			html.push('<tr>');
			html.push('<td style="padding: 5px; border: 1px solid #ccc; text-align: center;">' + (solve.index + 1) + '</td>');
			html.push('<td style="padding: 5px; border: 1px solid #ccc; text-align: center;">' + kpretty(solve.time * 1000) + '</td>');
			html.push('<td style="padding: 5px; border: 1px solid #ccc; font-family: monospace; font-size: 0.8em; max-width: 300px; word-break: break-all;">' + (solve.scramble || '-') + '</td>');
			html.push('<td style="padding: 5px; border: 1px solid #ccc;">' + (solve.comment || '-') + '</td>');
			html.push('</tr>');
		}
		html.push('</table>');
		
		container.html(html.join(''));

		// Use $.noop directly instead of storing in variable
		// showDialog format: [element, okCallback, cancelCallback, grayCallback]
		// $.noop is an empty function that will trigger the dialog to close
		kernel.showDialog([container, $.noop, undefined, $.noop], 'solveslist', title);
	}

	function loadWCARanking() {
		var resultsDiv = div.find('#wcaResults');
		resultsDiv.html('<p>Loading world ranking...</p>');

		// Get current session's best times
		var times_stats_table = stats.getTimesStatsTable();
		var bestSingle = times_stats_table.bestTime;
		var bestAo5 = times_stats_table.bestAvg(0, 0); // ao5

		console.log('Best times - Single:', bestSingle, 'Ao5:', bestAo5);

		if (bestSingle < 0 && bestAo5 < 0) {
			resultsDiv.html('<p>No valid times to rank.</p>');
			return;
		}

		// Convert times to centiseconds for WCA API
		var singleCentiseconds = bestSingle >= 0 ? Math.round(bestSingle / 10) : null;
		var ao5Centiseconds = bestAo5 >= 0 ? Math.round(bestAo5 / 10) : null;

		console.log('Centiseconds - Single:', singleCentiseconds, 'Ao5:', ao5Centiseconds);

		// CHANGED: Try a different approach - fetch directly without CORS proxy first
		// If that fails, the browser will use CORS mode and we'll handle it
		var wcaBaseUrl = 'https://www.worldcubeassociation.org/api/v0/rankings/333/';
		
		// CHANGED: Use a working CORS proxy - trying corsproxy.io instead
		var corsProxy = 'https://corsproxy.io/?';
		
		var promises = [];
		
		if (singleCentiseconds !== null) {
			var singleUrl = corsProxy + encodeURIComponent(wcaBaseUrl + 'single');
			console.log('Fetching single rankings from:', singleUrl);
			
			promises.push($.ajax({
				url: singleUrl,
				dataType: 'json',
				timeout: 20000,
				crossDomain: true
			}).then(function(data) {
				console.log('Single data received:', data);
				return { type: 'single', data: data, time: singleCentiseconds };
			}, function(xhr, status, error) {
				console.error('Single request failed:', status, error);
				return { type: 'single', data: null, time: singleCentiseconds, error: error };
			}));
		}

		if (ao5Centiseconds !== null) {
			var avgUrl = corsProxy + encodeURIComponent(wcaBaseUrl + 'average');
			console.log('Fetching average rankings from:', avgUrl);
			
			promises.push($.ajax({
				url: avgUrl,
				dataType: 'json',
				timeout: 20000,
				crossDomain: true
			}).then(function(data) {
				console.log('Average data received:', data);
				return { type: 'average', data: data, time: ao5Centiseconds };
			}, function(xhr, status, error) {
				console.error('Average request failed:', status, error);
				return { type: 'average', data: null, time: ao5Centiseconds, error: error };
			}));
		}

		if (promises.length === 0) {
			resultsDiv.html('<p>No valid times to rank.</p>');
			return;
		}

		$.when.apply($, promises).then(function() {
			var results = arguments.length === 1 ? [arguments[0]] : Array.prototype.slice.call(arguments);
			console.log('All results received:', results);
			
			var html = [];
			html.push('<table class="table" style="margin: 10px auto;">');
			html.push('<tr><th style="padding: 5px;">Type</th><th style="padding: 5px;">Your Time</th><th style="padding: 5px;">World Rank</th></tr>');
			
			var hasData = false;
			var errors = [];
			
			for (var i = 0; i < results.length; i++) {
				var result = results[i];
				var rank = null;
				var timeStr = '';
				
				// Check for errors
				if (result.error) {
					errors.push(result.type + ': ' + result.error);
					continue;
				}
				
				// Extract rankings array from WCA API response
				// WCA API returns { rankings: [...] } structure
				var rankings = result.data && result.data.rankings ? result.data.rankings : 
							   (Array.isArray(result.data) ? result.data : null);
				
				console.log(result.type + ' rankings extracted:', rankings ? rankings.length : 'null');
				
				if (result.type === 'single') {
					timeStr = kpretty(bestSingle);
					if (rankings && rankings.length > 0) {
						// Find rank by comparing times
						// WCA rankings are sorted best to worst
						for (var j = 0; j < rankings.length; j++) {
							var record = rankings[j];
							var recordTime = record.best || 0;
							if (result.time <= recordTime) {
								rank = record.rank || (j + 1);
								console.log('Found single rank:', rank, 'at index', j);
								break;
							}
						}
						if (rank === null) {
							// Time is worse than all ranked times
							var lastRecord = rankings[rankings.length - 1];
							rank = (lastRecord.rank || rankings.length) + 1;
							console.log('Single rank worse than all:', rank);
						}
					}
				} else if (result.type === 'average') {
					timeStr = kpretty(bestAo5);
					if (rankings && rankings.length > 0) {
						// Find rank by comparing times
						for (var j = 0; j < rankings.length; j++) {
							var record = rankings[j];
							var recordTime = record.average || 0;
							if (result.time <= recordTime) {
								rank = record.rank || (j + 1);
								console.log('Found average rank:', rank, 'at index', j);
								break;
							}
						}
						if (rank === null) {
							// Time is worse than all ranked times
							var lastRecord = rankings[rankings.length - 1];
							rank = (lastRecord.rank || rankings.length) + 1;
							console.log('Average rank worse than all:', rank);
						}
					}
				}
				
				if (rank !== null) {
					hasData = true;
					html.push('<tr>');
					html.push('<td style="padding: 5px;">' + (result.type === 'single' ? 'Single' : 'Average of 5') + '</td>');
					html.push('<td style="padding: 5px;">' + timeStr + '</td>');
					html.push('<td style="padding: 5px;">#' + rank.toLocaleString() + '</td>');
					html.push('</tr>');
				}
			}

			if (!hasData) {
				// More detailed error message
				var errorMsg = '<tr><td colspan="3" style="padding: 5px;">';
				if (errors.length > 0) {
					errorMsg += 'Failed to load ranking data: ' + errors.join(', ') + '<br>';
					errorMsg += 'Try opening browser console (F12) for more details.';
				} else {
					errorMsg += 'Could not load world ranking. The WCA API may be unavailable or the CORS proxy may be down.<br>';
					errorMsg += 'Check browser console (F12) for details.';
				}
				errorMsg += '</td></tr>';
				html.push(errorMsg);
			}

			html.push('</table>');
			resultsDiv.html(html.join(''));
		}).fail(function(xhr, status, error) {
			console.error('AJAX request failed:', status, error, xhr);
			resultsDiv.html('<p>Failed to load world ranking. Error: ' + status + ' - ' + error + '<br>Check browser console (F12) for details.</p>');
		});
	}

	function execFunc(fdiv, signal) {
		if (!(isEnable = (fdiv != undefined))) {
			return;
		}
		if (/^scr/.exec(signal)) {
			return;
		}
		fdiv.empty().append(div);
		updateAdvancedStats();
	}

	$(function() {
		if (typeof tools != "undefined") {
			tools.regTool('advancedstats', 'Advanced Stats', execFunc);
		}
		stats.regUtil('advancedstats', updateAdvancedStats);
	});

	return {
		update: updateAdvancedStats
	}
}, [kernel.pretty, kernel.round, kernel.pround]);

