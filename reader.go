package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Question struct {
	Text    string    `json:"question"`
	Options []string  `json:"alternatives"`
	Answer  string    `json:"correct"`
	Worth   int       `json:"worth"`
	QImage  *string   `json:"questionImage"`
	OImages []*string `json:"optionImages"`
}

type Questionary struct {
	Title      string     `json:"title"`
	Background *string    `json:"background"`
	Music      *string    `json:"music"`
	Questions  []Question `json:"questions"`
}

type QuestionaryInfo struct {
	URL           string `json:"url"`
	Title         string `json:"title"`
	HasMusic      bool   `json:"hasMusic"`
	HasBackground bool   `json:"hasBackground"`
	QuestionCount int    `json:"questionCount"`
	TotalWorth    int    `json:"totalWorth"`
}

func readQuestionaries() (map[string]QuestionaryInfo, error) {
	questionaries := make(map[string]QuestionaryInfo)

	files, err := os.ReadDir(geniusPlayPath)
	if err != nil {
		return nil, err
	}

	for _, file := range files {
		name := file.Name()
		path := filepath.Join(geniusPlayPath, name)

		if filepath.Ext(name) == ".qn" {
			q, err := parseOldQuestionFile(path)
			if err != nil {
				continue
			}
			savePath := strings.TrimSuffix(path, ".qn") + ".json"
			saveOldAsJSON(q, savePath)
			name = filepath.Base(savePath)
			path = savePath
		}

		if filepath.Ext(name) == ".json" {
			fileData, err := os.ReadFile(path)
			if err != nil {
				continue
			}

			var q Questionary
			if err := json.Unmarshal(fileData, &q); err != nil {
				continue
			}

			totalWorth := 0
			for _, question := range q.Questions {
				totalWorth += question.Worth
			}

			questionaries[name] = QuestionaryInfo{
				URL:           "/uploads/" + name,
				Title:         q.Title,
				HasMusic:      q.Music != nil,
				HasBackground: q.Background != nil,
				QuestionCount: len(q.Questions),
				TotalWorth:    totalWorth,
			}
		}
	}

	return questionaries, nil
}

func parseOldQuestionFile(path string) (*Questionary, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	q := &Questionary{
		Background: nil,
		Music:      nil,
	}

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "#") {
			q.Title = strings.TrimSpace(line[1:])
		} else {
			question, err := parseOldQuestionLine(line)
			if err == nil {
				q.Questions = append(q.Questions, *question)
			}
		}
	}

	if len(q.Questions) == 0 {
		return nil, fmt.Errorf("arquivo sem questões válidas")
	}

	return q, nil
}

func parseOldQuestionLine(line string) (*Question, error) {
	parts := strings.Split(line, "%")
	if len(parts) != 5 {
		return nil, fmt.Errorf("formato inválido")
	}

	text := strings.TrimSpace(parts[0])
	alternatives := make([]string, 0, 4)
	oImages := []*string{nil, nil, nil, nil}
	correct := ""

	for _, part := range parts[1:] {
		option := strings.TrimSpace(part)
		if strings.HasPrefix(option, "*") {
			option = strings.TrimPrefix(option, "*")
			correct = option
		}
		alternatives = append(alternatives, option)
	}

	if correct == "" {
		return nil, fmt.Errorf("nenhuma resposta correta especificada")
	}

	return &Question{
		Text:    text,
		Options: alternatives,
		Answer:  correct,
		Worth:   1,
		QImage:  nil,
		OImages: oImages[:len(alternatives)],
	}, nil
}

func saveOldAsJSON(q *Questionary, path string) {
	data, err := json.MarshalIndent(q, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(path, data, 0644)
}
