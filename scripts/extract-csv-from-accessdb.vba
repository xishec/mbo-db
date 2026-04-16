Sub Export_All_Tables_To_CSV()

    ExportTableToCSV "tblCaptures", _
        "C:\Users\Xi Chen\Documents\tblCaptures.csv"

    ExportTableToCSV "tblDETDaily", _
        "C:\Users\Xi Chen\Documents\tblDETDaily.csv"

    ExportTableToCSV "tblDETSpecies", _
        "C:\Users\Xi Chen\Documents\tblDETSpecies.csv"

    ExportTableToCSV "tblSpecies", _
        "C:\Users\Xi Chen\Documents\tblSpecies.csv"

    ExportTableToCSV "tblDETNetHours", _
        "C:\Users\Xi Chen\Documents\tblDETNetHours.csv"

    MsgBox "All CSV exports completed successfully.", vbInformation

End Sub


Private Sub ExportTableToCSV(tableName As String, filePath As String)

    On Error GoTo ExportError

    DoCmd.TransferText _
        TransferType:=acExportDelim, _
        TableName:=tableName, _
        FileName:=filePath, _
        HasFieldNames:=True

    Exit Sub

ExportError:
    MsgBox "Error exporting " & tableName, vbCritical

End Sub