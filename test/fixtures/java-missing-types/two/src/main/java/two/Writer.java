package two;

import beta.Sink;
import beta.Buffer;

public class Writer {
    public Object write() { return Sink.open(Buffer.EMPTY); }
}
