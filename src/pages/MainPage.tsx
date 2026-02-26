import { TextEditor } from "../components";

function MainPage() {
    return (
        <div className="flex flex-1 h-full overflow-hidden">
            <div className="grow bg-background-primary min-h-0 overflow-hidden">
                <TextEditor />
            </div>
        </div>
    );
}

export default MainPage
