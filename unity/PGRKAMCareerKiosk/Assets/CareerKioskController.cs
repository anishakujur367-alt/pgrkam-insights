
using UnityEngine;
using UnityEngine.UI;

public class CareerKioskController : MonoBehaviour
{
    public Toggle pythonToggle;
    public Toggle javascriptToggle;
    public Toggle sqlToggle;

    void Start()
    {
        pythonToggle.onValueChanged.AddListener(
            isOn => UpdateSkill("Python", isOn)
        );

        javascriptToggle.onValueChanged.AddListener(
            isOn => UpdateSkill("JavaScript", isOn)
        );

        sqlToggle.onValueChanged.AddListener(
            isOn => UpdateSkill("SQL", isOn)
        );
    }

    void UpdateSkill(string skill, bool isOn)
    {
        Debug.Log(skill + (isOn ? " selected" : " unselected"));
    }

    public void OpenJobsPage()
    {
        Debug.Log("Opening PGRKAM Jobs Page!");

        Application.OpenURL(
            "https://pgrkam-insight.vercel.app/#jobs"
        );
    }
}
