package http;

@RestController
@RequestMapping("/archive")
public class ArchiveController extends ArchiveBase {
    @Override
    public String archived() {
        return "archived";
    }
}
