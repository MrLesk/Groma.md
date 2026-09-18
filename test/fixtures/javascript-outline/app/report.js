function render(report) {
  return format(report.lines)
}

function format(lines) {
  return lines.join('\n')
}

exports.render = function (report) {
  return render(report)
}
