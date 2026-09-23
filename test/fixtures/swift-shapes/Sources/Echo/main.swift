let server = Server()
server.handle { request in
    func render() -> String { "ok" }
    return render()
}
